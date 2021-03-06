define([
    "leaflet",
    "woodman",
    "gp",
    "Common/Utils/CheckRightManagement",
    "Common/Controls/MousePositionDOM",
    "Leaflet/Controls/Utils/PositionFormater",
    "Leaflet/CRS/CRS"
], function (
    L,
    woodman,
    Gp,
    RightManagement,
    MousePositionDOM,
    PositionFormater,
    CRS
) {

    "use strict";

    var logger = woodman.getLogger("mouseposition");

   /**
    * @classdesc
    *
    * Leaflet Control Class to display Mouse position in various CRS and altitude using the <a href="http://api.ign.fr/tech-docs-js/developpeur/alti.html" target="_blank">altimetric web service of the Geoportal Platform</a>.
    *
    * Use {@link module:Controls.MousePosition L.geoportalControl.MousePosition()} factory to create instances of that class.
    *
    * **Extends** Leaflet <a href="http://leafletjs.com/reference.html#control" target="_blank">L.Control</a> native class.
    *
    * @namespace
    * @alias L.geoportalControl.MousePosition
    */
    var MousePosition = L.Control.extend( /** @lends L.geoportalControl.MousePosition.prototype */ {

        includes : MousePositionDOM,

        /**
        * options by default
        *
        * @private
        */
        options : {
            position : "bottomleft",
            collapsed : true,
            units : [],
            systems : [],
            displayAltitude : true,
            displayCoordinate : true,
            altitude : {
                triggerDelay : 200,
                responseDelay : 500,
                noDataValue : -99999,
                noDataValueTolerance : 90000,
                serviceOptions : {}
            }
        },

        /**
        * @constructor MousePosition
        *
        * @private
        * @alias MousePosition
        * @extends {L.Control}
        * @param {Object} options - options for function call.
        * @param {Sting}   [options.apiKey] - API key, mandatory if autoconf service has not been charged in advance
        * @param {String}  [options.position] - position of component into the map, 'bottomleft' by default
        * @param {Boolean} [options.collapsed] - collapse mode, false by default
        * @param {Array}   [options.systems] - list of projection systems, GEOGRAPHIC, MERCATOR, LAMB93 and LAMB2E by default
        *      Each array element (=system) is an object with following properties :
        * @param {String}  options.systems.crs - Proj4 crs alias (from proj4 defs). e.g. : "EPSG:4326". Required
        * @param {String}  [options.systems.label] - CRS label to be displayed in control. Default is crs code (e.g. "EPSG:4326")
        * @param {String}  [options.systems.type] - CRS units type for coordinates conversion : "Geographical" or "Metric". Default: "Metric"
        * @param {Array}   [options.units] - list of units by system, Geographical and Metric by default
         *      Values may be "DEC" (decimal degrees), "DMS" (sexagecimal), "RAD" (radians) and "GON" (grades) for geographical coordinates,
         *      and "M" or "KM" for metric coordinates
        * @param {Boolean} [options.displayAltitude] - active/desactivate the altitude panel, if desactivate, have just the coordinate panel, true by default
        * @param {Boolean} [options.displayCoordinate] - active/desactivate the coordinate panel, if desactivate, have just the altitude panel, true by default
        * @param {Object}  [options.altitude] - elevation configuration
        * @param {Object}  [options.altitude.serviceOptions] - options of elevation service
        * @param {Number}  [options.altitude.responseDelay] - latency for altitude request, 500 ms by default
        * @param {Number}  [options.altitude.triggerDelay] - immobilisation time of movement on the map to trigger the elevation calculation, 200 ms by default
        * @param {Number}  [options.altitude.noDataValue] - value used for altitude service no data (default is -99999). In this case, "---m" will be displayed instead of "-99999m"
        * @param {Number}  [options.altitude.noDataValueTolerance] - tolerance for no data value :
        *                  values in [noDataValue - noDataValueTolerance ; noDataValue + noDataValueTolerance] interval will not be displayed, but "---m" will be displayed instead.
        *                  Default is 90000
        * @example
        *  var MousePosition = L.geoportalControl.MousePosition({
        *      position : 'bottomleft',
        *      collapsed : false,
        *      displayAltitude : true,
        *      altitude : {
        *           triggerDelay : 100,
        *           responseDelay : 500,
        *           noDataValue : -99999,
        *           noDataValueTolerance : 90000,
        *           serviceOptions : {}
        *      },
        *      systems : [
        *       {
        *          crs : L.CRS.EPSG4326,
        *          label : "Lon,Lat",
        *          type : "Geographical"
        *        },
        *       {
        *          crs : L.geoportalCRS.EPSG2154,
        *          label : "Lambert 93",
        *          type : "Metric"
        *        }
        *      ],
        *      units : ["DEC", "DMS"]
        *  });
        */
        initialize : function (options) {

            // on merge les options avec celles par defaut
            L.Util.extend(this.options, options);

            // initialisation des systemes de projections
            this._projectionSystems = [];
            this._initProjectionSystems();

            // initialisation des systemes des unités
            this._projectionUnits = {};
            this._initProjectionUnits();

            /** detection du support : desktop ou tactile */
            this._isDesktop = this._detectSupport();

            // on met en place un seuil sur le timer
            if (this.options.altitude.triggerDelay < 100) {
                this.options.altitude.triggerDelay = 100;
            }

            /** timer sur le delai d'immobilisation du mouvement */
            this._timer = this.options.altitude.triggerDelay;

            /** Systeme de projection selectionné (cf. _initProjectionSystems) */
            this._currentProjectionSystems = this._projectionSystems[0];

            /** Container des systemes */
            this._projectionSystemsContainer = null;

            /** Type d'unité de projection selectionnés : Geographical ou Metric (cf._initProjectionSystems ) */
            this._currentProjectionType = this._projectionSystems[0].type;

            /** Unité de projection selectionnés (cf. _initProjectionUnits) */
            this._currentProjectionUnits = this._projectionUnits[this._currentProjectionType][0].code;

            /** Container des unités */
            this._projectionUnitsContainer = null;

            /** Container de visualisation du panneau du composant */
            this._showMousePositionContainer = null;

            // gestion de l'affichage du panneau de l'altitude / coordonnées
            if (!this.options.displayAltitude && !this.options.displayCoordinate) {
                // on reactive cette option !
                this.options.displayCoordinate = true;
            }

            /**
            * Droit sur le ressource alti.
            * Par defaut, on n'en s'occupe pas
            * sauf si l'autoconfiguration est chargée !
            */
            this._noRightManagement = false;

            // gestion des droits sur les ressources/services
            // si l'on souhaite un calcul d'altitude, on verifie
            // les droits sur les ressources d'alti...
            if (this.options.displayAltitude) {
                this._checkRightsManagement();
            }

            // on transmet les options au controle
            L.Util.setOptions(this, this.options);
        },

        /**
        * this method is called by this.addTo(map) when the control is added on the map
        * and fills variable 'this._container = this.onAdd(map)',
        * and create events on map.
        *
        * @private
        */
        onAdd : function (map) {

            // initialisation du DOM du composant
            var container = this._container = this._initLayout();

            // on met en place l'evenement sur la carte pour recuperer les coordonnées,
            // on l'active à l'ouverture du panneau uniquement !
            if (! this.options.collapsed) {
                // this.onShowMousePositionClick();
                // evenement valable pour le mode desktop !
                if (this._isDesktop) {
                    map.on("mousemove", this.onMouseMove, this);
                } else {
                    map.on("move", this.onMapMove, this);
                }
            }

            // deactivate of events that may interfere with the map
            L.DomEvent
                .disableClickPropagation(container)
                .disableScrollPropagation(container);

            // on stoppe la propagation de l'événement mousemove sur le container
            L.DomEvent
               .addListener(container, "mousemove", L.DomEvent.stopPropagation)
               .addListener(container, "mousemove", L.DomEvent.preventDefault);

            return container;
        },

        /**
        * this method is called when the control is removed from the map
        * and removes events on map.
        *
        * @private
        */
        onRemove : function (map) {

            map.off("mousemove", this.onMouseMove);
        },

        /**
        * this method is called by the constructor and initialize the projection
        * systems.
        * getting coordinates in the requested projection :
        * see this.onMousePositionProjectionSystemChange()
        *
        * @private
        */
        _initProjectionSystems : function () {

            // on donne la possibilité à l'utilisateur de modifier
            // la liste des systèmes à afficher
            // Ex. this.options.systems

            // systemes de projection disponible par defaut
            var projectionSystemsByDefault = [
                {
                    code : "GEOGRAPHIC",
                    label : "Géographique",
                    crs : L.CRS.Simple, // L.Projection.LonLat !
                    type : "Geographical"
                },
                {
                    code : "MERCATOR",
                    label : "Web Mercator",
                    crs : L.CRS.EPSG3395, // L.Projection.SphericalMercator !
                    type : "Metric"
                },
                {
                    code : "LAMB93",
                    label : "Lambert 93",
                    crs : CRS.EPSG2154,
                    type : "Metric"
                },
                {
                    code : "LAMB2E",
                    label : "Lambert II étendu",
                    crs : CRS.EPSG27572,
                    type : "Metric"
                }
            ];

            var systems = this.options.systems;
            for (var i = 0; i < systems.length; i++) {

                // definition d'un systeme de reference
                var sys = systems[i];

                if (! sys.label && ! sys.code) {
                    logger.error("label srs not defined !");
                    continue;
                }

                if (! sys.label) {
                    sys.label = sys.code;
                }

                if (! sys.crs) {
                    logger.error("crs not defined !");
                    continue;
                }

                if (! sys.type) {
                    logger.warn("type srs not defined, use 'Metric' by default !");
                    sys.type = "Metric";
                }

                this._projectionSystems.push(systems[i]);

                // it's a just a test ...
                var found = false;
                for (var j = 0; j < projectionSystemsByDefault.length; j++) {
                    var obj = projectionSystemsByDefault[j];
                    if (sys.crs === obj.crs) {
                        found = true;
                        logger.info("crs '{}' already configured by default", obj.code);
                    }
                }
                if (! found) {
                    logger.info("crs '{}' not found, it's a new projection", sys.code || sys.label);
                }
            }

            // au cas où...
            if (this._projectionSystems.length === 0) {
                this._projectionSystems = projectionSystemsByDefault;
            }

        },

        /**
        * this method is called by the constructor and initialize the units.
        * getting coordinates in the requested units :
        * see this.onMousePositionProjectionUnitsChange()
        *
        * @private
        */
        _initProjectionUnits : function () {

            // on donne la possibilité à l'utilisateur de modifier
            // la liste des unités à afficher
            // Ex.
            // this.options.units : ["DEC", "DMS"]

            // unités disponible par defaut
            var projectionUnitsByDefault = {
                Geographical : [
                    {
                        code : "DEC",
                        label : "degrés décimaux",
                        convert : this._displayDEC
                    },
                    {
                        code : "DMS",
                        label : "degrés sexagésimaux",
                        convert : this._displayDMS
                    },
                    {
                        code : "RAD",
                        label : "radians",
                        convert : this._displayRAD
                    },
                    {
                        code : "GON",
                        label : "grades",
                        convert : this._displayGON
                    }
                ],
                Metric : [
                    {
                        code : "M",
                        label : "mètres",
                        convert : this._displayMeter
                    },
                    {
                        code : "KM",
                        label : "kilomètres",
                        convert : this._displayKMeter
                    }
                ]
            };

            var units = this.options.units;

            for (var type in projectionUnitsByDefault) {
                if (projectionUnitsByDefault.hasOwnProperty(type)) {
                    var found = false;
                    for (var j = 0; j < projectionUnitsByDefault[type].length; j++) {
                        var obj = projectionUnitsByDefault[type][j];
                        for (var i = 0; i < units.length; i++) {
                            var unit = units[i];
                            if (obj.code === unit) {
                                found = true;
                                if (! this._projectionUnits[type]) {
                                    this._projectionUnits[type] = [];
                                }
                                this._projectionUnits[type].push(obj);
                            }
                        }
                    }
                    if (!found) {
                        this._projectionUnits[type] = projectionUnitsByDefault[type];
                    }
                }
            }

            // au cas où...
            if (Object.keys(this._projectionUnits).length === 0) {
                this._projectionUnits = projectionUnitsByDefault;
            }

        },

        /**
        * this method is called by constructor
        * and check the rights to resources
        *
        * @private
        */
        _checkRightsManagement : function () {

            var rightManagement = RightManagement.check({
                key : this.options.apiKey,
                resources : ["SERVICE_CALCUL_ALTIMETRIQUE_RSC"],
                services : ["Elevation"]
            });

            if (! rightManagement) {
                this._noRightManagement = true;
            }

            // on recupère les informations utiles
            // sur ce controle, on ne s'occupe pas de la ressource car elle est unique...
            // Ex. la clef API issue de l'autoconfiguration si elle n'a pas
            // été renseignée.
            if (! this.options.apiKey) {
                this.options.apiKey = rightManagement.key;
            }
        },

        /**
        * this method is called by the constructor.
        * this information is useful to switch to touch mode.
        * Detection : test for desktop or tactile
        *
        * @private
        */
        _detectSupport : function () {

            // TODO
            // Choix de gérer la détection dans le code du composant au lieu du DOM car :
            // Utilisation de l'implémentation Leaflet
            // http://leafletjs.com/reference.html#browser

            var isDesktop = true;
            var userAgent = window.navigator.userAgent.toLowerCase();

            if (userAgent.indexOf("iphone") !== -1 ||
                userAgent.indexOf("ipod") !== -1 ||
                userAgent.indexOf("ipad") !== -1 ||
                userAgent.indexOf("android") !== -1 ||
                userAgent.indexOf("mobile") !== -1 ||
                userAgent.indexOf("blackberry") !== -1 ||
                userAgent.indexOf("tablet") !== -1 ||
                userAgent.indexOf("phone") !== -1 ||
                userAgent.indexOf("touch") !== -1 ) {
                isDesktop = false;
            }

            if (userAgent.indexOf("msie") !== -1 ||
                userAgent.indexOf("trident") !== -1) {
                isDesktop = true;
            }

            return isDesktop;
        },

        // ################################################################### //
        // ######################## methods handle dom ####################### //
        // ################################################################### //

        /**
        * this method is called by this.onAdd(map)
        * and initialize the container HTMLElement
        *
        * @private
        */
        _initLayout : function () {

            // create main container
            var container = this._createMainContainerElement();

            var inputShow = this._showMousePositionContainer = this._createShowMousePositionElement();
            container.appendChild(inputShow);

            // mode "collapsed"
            if (! this.options.collapsed) {
                inputShow.checked = true;
            }

            var picto = this._createShowMousePositionPictoElement(this._isDesktop);
            container.appendChild(picto);

            var panel    = this._createMousePositionPanelElement(this.options.displayAltitude, this.options.displayCoordinate);
            var settings = this._createMousePositionSettingsElement();
            var systems  = this._projectionSystemsContainer = this._createMousePositionSettingsSystemsElement(this._projectionSystems);
            var units    = this._projectionUnitsContainer   = this._createMousePositionSettingsUnitsElement(this._projectionUnits[this._currentProjectionType]);
            settings.appendChild(systems);
            settings.appendChild(units);
            panel.appendChild(settings);
            container.appendChild(panel);

            // ce tag n'est pas à placer dans le container du controle,
            // mais dans celui de la map !
            var center = this._createMapCenter();
            var map = this._map;
            map.getContainer().appendChild(center);

            return container;
        },

        /**
        * this method is called by this.()
        * and it changes the elevation view panel into the dom.
        * FIXME call by ID !
        *
        * @param {Boolean} active - true:active, false:disable
        *
        * @private
        */
        _setElevationPanel : function (active) {
            var div = null;

            if (! active) {
                div = L.DomUtil.get("GPmousePositionAltitude");
                div.style.display = "none";
            }

            if (active && this._noRightManagement) {
                div = L.DomUtil.get("GPmousePositionAlt");
                div.innerHTML = "no right !";
            }
        },

        /**
        * this method is called by this.()
        * and it changes the coordinate view panel into the dom.
        * FIXME call by ID !
        *
        * @param {Boolean} active - true:active, false:disable
        *
        * @private
        */
        _setCoordinatePanel : function (active) {
            if (! active) {
                var div  = L.DomUtil.get("GPmousePositionCoordinate");
                div.style.display = "none";
            }
        },

        /**
        * this method is called by this.()
        * and it changes the settings view panel into the dom.
        * FIXME call by ID !
        *
        * @param {Boolean} active - true:active, false:disable
        *
        * @private
        */
        _setSettingsPanel : function (active) {
            if (! active) {
                var divPicto  = L.DomUtil.get("GPshowMousePositionSettingsPicto");
                var divPanel  = L.DomUtil.get("GPmousePositionSettings");
                divPicto.style.display = "none";
                divPanel.style.display = "none";
            }
        },

        /**
        * this method is called by this.onMousePositionProjectionSystemChange()
        * when changes to a metric or a geographical units.
        *
        * @param {String} type - Geographical or Metric
        *
        * @private
        */
        _setTypeUnitsPanel : function (type) {
            var container = this._projectionUnitsContainer;

            // on supprime les enfants...
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }

            var units = this._projectionUnits[type];
            for (var j = 0; j < units.length; j++) {
                var obj = units[j];
                var option = document.createElement("option");
                option.value = (obj.code) ? obj.code : j;
                option.text  = obj.label || j;
                // option.label = obj.label;
                container.appendChild(option);
            }

            // le nouveau type de system ...
            this._currentProjectionType = type;
            // et comme on a changé de type de systeme,
            // il faut changer aussi d'unité !
            this._currentProjectionUnits = this._projectionUnits[type][0].code;
        },

        // ################################################################### //
        // ######################## method units convert ##################### //
        // ################################################################### //

        /**
        * degreedecimal
        *
        * @private
        */
        _displayDEC : function (oLatLng) {
            var coordinate = {};
            coordinate.lat = PositionFormater.roundToDecimal(oLatLng.lat, 6);
            coordinate.lng = PositionFormater.roundToDecimal(oLatLng.lng, 6);
            return coordinate;
        },

        /**
        * degreedecimal2sexagecimal
        *
        * @private
        */
        _displayDMS : function (oLatLng) {
            var coordinate = {};
            coordinate.lat = PositionFormater.decimalLatToDMS(oLatLng.lat);
            coordinate.lng = PositionFormater.decimalLongToDMS(oLatLng.lng);
            return coordinate;

        },

        /**
        * degreedecimal2radian
        *
        * @private
        */
        _displayRAD : function (oLatLng) {
            var coordinate = {};
            coordinate.lat = PositionFormater.decimalToRadian(oLatLng.lat);
            coordinate.lng = PositionFormater.decimalToRadian(oLatLng.lng);
            return coordinate;

        },

        /**
        * degreedecimal2grade
        *
        * @private
        */
        _displayGON : function (oLatLng) {
            var coordinate = {};
            coordinate.lat = PositionFormater.decimalToGrade(oLatLng.lat);
            coordinate.lng = PositionFormater.decimalToGrade(oLatLng.lng);
            return coordinate;

        },

        /**
        * meter
        *
        * @private
        */
        _displayMeter : function (oXY) {
            // on recoit toujours des coordonnées metriques
            var coordinate = {};
            coordinate.x = L.Util.formatNum(oXY.x, 2);
            coordinate.y = L.Util.formatNum(oXY.y, 2);
            coordinate.unit = "m";
            return coordinate;

        },

        /**
        * kilometer
        *
        * @private
        */
        _displayKMeter : function (oXY) {
            var coordinate = {};
            coordinate.x = L.Util.formatNum(oXY.x / 1000, 2);
            coordinate.y = L.Util.formatNum(oXY.y / 1000, 2);
            coordinate.unit = "km";
            return coordinate;

        },

        // ################################################################### //
        // ####################### method system project ##################### //
        // ################################################################### //

        /**
        * this method projects a coordinate to a specific projection.
        * FIXME
        *
        * @param {Object} oLatLng - geographic coordinate (L.LatLng)
        * @param {Object} crs - projection system (ex. GEOGRAPHIC, LAMB93, LAMB2E, MERCATOR, ...)
        *
        * @private
        */
        _project : function (oLatLng, crs) {

            // cf. http://leafletjs.com/reference.html#iprojection
            // notre carte est dans la projection par defaut :
            // Spherical Mercator projection (EPSG:3857)
            // - GEOGRAPHIC : conversion native, L.CRS.Simple ou L.Projection.LngLat.project(latlng)
            // - LAMB93 : L.GeoportalCRS.EPSG2154 ou projection.project(latlng)
            // - LAMB2E : L.GeoportalCRS.EPSG27572 ou projection.project(latlng)
            // - MERCATOR ou EPSG:3395 : L.CRS.EPSG3395 ou L.Projection.Mercator.project(latlng)

            if ( typeof crs === "function" ) {
                // "crs is an function !"... en mode AMD !
                crs = crs();
            }

            if ( typeof crs !== "object" ) {
                logger.log("crs is not an object !");
                return;
            }

            // pas de reprojection pour le systeme de projection natif !
            if (crs === L.CRS.Simple) {
                return oLatLng;
            }

            if (! crs.projection || typeof crs.projection !== "object") {
                logger.error("projection is not an object !");
                return;
            }

            var oPoint = crs.projection.project(oLatLng);

            // FIXME reprojeter du geographique en geographique cause qq problemes
            // Ex. LatLng en EPSG4326 !
            // FIXME probleme d'inversion d'axe sur les projections geographiques
            // Ex. EPSG:4326 -> lat/lon
            //     IGNF:RGF93G -> lon/lat
            if (this._currentProjectionType === "Geographical") {
                oPoint.lat = oPoint.y;
                oPoint.lng = oPoint.x;
            }

            if (! oPoint || Object.keys(oPoint).length === 0) {
                logger.error("Failed to project with crs code : " + crs.code);
            }

            return oPoint;
        },

        // ################################################################### //
        // ##################### handlers events to control ################## //
        // ################################################################### //

        /**
        * this sends the coordinates to the panel.
        * (cf. this.GPdisplayCoords() into the DOM functions)
        *
        * @param {Object} oLatLng - geographic coordinate (L.LatLng)
        *
        * @private
        */
        _setCoordinate : function (oLatLng) {

            // structure
            // L.LatLng
            //     lat: 4.07249425916745
            //     lng: 2.4609375

            // type de systeme : Geographical ou Metric
            var type = this._currentProjectionSystems.type;

            // on recherche la fonction de formatage dans l'unitée demandée
            var convert = null;
            var units = this._projectionUnits[type];
            for (var i = 0; i < units.length; i++) {
                if (units[i].code === this._currentProjectionUnits) {
                    convert = units[i].convert;
                    break;
                }
            }

            // structure pour les coordonnées en fonctin du type demandé :
            // {x:, y:, unit:} ou {lng:, lat:} ou {lon:, lat:} ou {e:, n:, unit:}...
            var coordinate = {};
            // on projete le point dans le systeme demandé
            var oSrs = this._currentProjectionSystems.crs;
            if (! oSrs) {
                logger.error("crs not found !");
                return;
            }
            coordinate = convert(this._project(oLatLng, oSrs));

            if (! coordinate || Object.keys(coordinate).lenght === 0) {
                return;
            }

            this.GPdisplayCoords(coordinate);
        },

        /**
        * this sends the coordinates to the panel.
        * (cf. this.GPdisplayElevation() into the DOM functions)
        *
        * @param {Object} oLatLng - geographic coordinate (L.LatLng)
        *
        * @private
        */
        _setElevation : function (oLatLng) {
            // gestion du timer de la requete du service d'altitude
            var delay = this.options.altitude.responseDelay;
            var noDataValue = this.options.altitude.noDataValue;
            var noDataValueTolerance = this.options.altitude.noDataValueTolerance;
            this.GPdisplayElevation(oLatLng, delay, noDataValue, noDataValueTolerance);
        },

        /**
        * this method is triggered when the mouse or the map is stopped.
        * (cf. onMouseMove and onMapMove)
        *
        * @param {Object} oLatLng - geographic coordinate (L.LatLng)
        *
        * @private
        */
        onMoveStopped : function (oLatLng) {
            // si pas de droit, on ne met pas à jour l'affichage !
            if (this._noRightManagement) {
                return;
            }
            this._setElevation(oLatLng);
        },

        /**
        * this method is an handler event to control. The event is 'mousemove' on
        * the map. The handler sends the coordinates to the panel.
        * (cf. this.GPdisplayCoords() into the DOM functions)
        *
        * @param {Object} e - HTMLElement
        *
        * @private
        */
        onMouseMove : function (e) {

            var self = this;

            var oLatLng = e.latlng;

            this._setCoordinate(oLatLng);

            clearTimeout(this._timer);
            this._timer = setTimeout( function () {
                self.onMoveStopped(oLatLng);
            }, this.options.altitude.triggerDelay);
        },

        /**
        * this method is an handler event to control. The event is 'moveend' on
        * the map. The handler sends the coordinates to the panel.
        * (cf. this.GPdisplayCoords() into the DOM functions)
        *
        * @private
        */
        onMapMove : function () {

            var self = this;
            var map  = this._map;

            var oLatLng = map.getCenter();

            this._setCoordinate(oLatLng);

            clearTimeout(this._timer);
            this._timer = setTimeout( function () {
                self.onMoveStopped(oLatLng);
            }, this.options.altitude.triggerDelay);
        },

        // ################################################################### //
        // ####################### handlers events to dom #################### //
        // ################################################################### //

        /**
        * this method is called by this.GPdisplayCoords() in the dom, and
        * it executes a request to the elevation service.
        *
        * @param {Object} coordinate - {lat:..., lng:...}
        *
        * @private
        */
        onRequestAltitude : function (coordinate, callback) {

            logger.log("onRequestAltitude");

            // INFORMATION
            // on effectue la requête au service d'altitude...
            // on met en place des callbacks afin de recuperer les resultats ou
            // les messages d'erreurs du service.
            // le resultat est affiché dans une balise du dom.
            // les messages d'erreurs sont affichés sur la console (?)

            if (!coordinate || Object.keys(coordinate).length === 0) {
                return;
            }

            // si on ne veut pas de calcul d'altitude, on ne continue pas !
            if (!this.options.displayAltitude) {
                return;
            }

            // si on n'a pas les droits sur la ressource, pas la peine de
            // continuer !
            if (this._noRightManagement) {
                return;
            }

            logger.log(coordinate);

            var options = {};
            // on recupere les options du service
            L.Util.extend(options, this.options.altitude.serviceOptions);

            // ainsi que les coordonnées
            L.Util.extend(options, {
                zonly : true,
                positions : [
                    {
                        lon : coordinate.lon || coordinate.lng,
                        lat : coordinate.lat
                    }
                ]
            });

            // et les callbacks
            L.Util.extend(options, {
                scope : this,
                /** callback onSuccess */
                onSuccess : function (results) {
                    logger.log(results);
                    if (results && Object.keys(results)) {
                        // var context = this.options.scope;
                        // context._setAltidude(results.elevations[0].z);
                        callback.call(this, results.elevations[0].z);
                    }
                },
                /** callback onFailure */
                onFailure : function (error) {
                    logger.error(error.message);
                }
            });

            // cas où la clef API n'est pas renseignée dans les options du service,
            // on utilise celle de l'autoconf ou celle renseignée au niveau du controle
            L.Util.extend(options, {
                apiKey : options.apiKey || this.options.apiKey
            });

            logger.log(options);

            Gp.Services.getAltitude(options);
        },

        /**
        * this method is called by event 'click' on 'GPshowMousePositionPicto' tag label
        * (cf. this._createShowMousePositionPictoElement),
        * and toggles event 'mousemove' on map.
        * FIXME
        *
        * @param {Object} e - HTMLElement
        *
        * @private
        */
        onShowMousePositionClick : function (e) {

            logger.log(e);

            // checked : true - panel close
            // checked : false - panel open
            var map = this._map;

            // evenement declenché à l'ouverture/fermeture du panneau,
            // et en fonction du mode : desktop ou tactile !
            if (this._showMousePositionContainer.checked) {
                (this._isDesktop) ?
                    map.off("mousemove", this.onMouseMove, this) :
                    map.off("move", this.onMapMove, this);
            } else {
                (this._isDesktop) ?
                    map.on("mousemove", this.onMouseMove, this) :
                    map.on("move", this.onMapMove, this);
            }

            // on gère l'affichage des panneaux ici...,
            // même si ce n'est pas l'endroit adequate...
            this._setElevationPanel(this.options.displayAltitude);
            this._setCoordinatePanel(this.options.displayCoordinate);
            if (! this.options.displayCoordinate) {
                this._setSettingsPanel(false);
            }
        },

        /**
        * this method is called by event 'change' on 'GPmousePositionProjectionSystem'
        * tag select (cf. this._createMousePositionSettingsElement),
        * and selects the system projection.
        *
        * @param {Object} e - HTMLElement
        *
        * @private
        */
        onMousePositionProjectionSystemChange : function (e) {

            var idx   = e.target.selectedIndex;      // index
            var value = e.target.options[idx].value; // code, ex. MERCATOR (optionnel)
            var label = e.target.options[idx].label; // etiquette, ex Géographiques

            logger.log(idx, value, label);

            // si on change de type de systeme, on doit aussi changer le type d'unités !
            var type = this._projectionSystems[idx].type;
            if (type !== this._currentProjectionType) {
                this._setTypeUnitsPanel(type);
            }

            // on enregistre le systeme courrant
            this._currentProjectionSystems = this._projectionSystems[idx];

            // on simule un deplacement en mode tactile pour mettre à jour les
            // resultats
            if (!this._isDesktop) {
                this.onMapMove();
            }
        },

        /**
        * this method is called by event 'change' on 'GPmousePositionProjectionUnits'
        * tag select (cf. this._createMousePositionSettingsElement),
        * and selects the units projection.
        *
        * @param {Object} e - HTMLElement
        *
        * @private
        */
        onMousePositionProjectionUnitsChange : function (e) {

            var idx   = e.target.selectedIndex;
            var value = e.target.options[idx].value;
            var label = e.target.options[idx].label;

            logger.log(idx, value, label);

            this._currentProjectionUnits = value;

            // on simule un deplacement en mode tactile pour mettre à jour les
            // resultats
            if (!this._isDesktop) {
                this.onMapMove();
            }
        }
    });

    return MousePosition;
});
