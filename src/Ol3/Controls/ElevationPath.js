/* globals AmCharts, d3 */
define([
    "ol",
    "woodman",
    "gp",
    "Ol3/Utils",
    "Common/Utils/CheckRightManagement",
    "Common/Controls/ElevationPathDOM",
    "Common/Utils/SelectorID"
], function (
    ol,
    woodman,
    Gp,
    Utils,
    RightManagement,
    ElevationPathDOM,
    ID
) {

    "use strict";

    woodman.load("console");
    var logger = woodman.getLogger("elevationpath");

    /**
    * @example
    * var measure = new ol.control.ElevationPath({
    *    element : null,
    *    target : null,
    *    render : null,
    *    collapsed : true,
    *    stylesOptions : {
    *     draw : {
    *       start : {
    *           fillColor : "rgba(255, 255, 255, 0.2)",
    *           strokeColor : "rgba(0, 0, 0, 0.5)",
    *           strokeLineDash : [10, 10],
    *           strokeWidth : 2,
    *           imageRadius : 5,
    *           imageFillColor : "rgba(255, 255, 255, 0.2)",
    *           imageStrokeColor : "rgba(0, 0, 0, 0.7)"
    *       },
    *       finish : {}
    *     },
    *     marker : {},
    *     graph : {}
    *    },
    *    elevationPathOptions : {},
    * });
    */
    function ElevationPath (options) {
        logger.trace("ElevationPath()");

        /** options */
        options = options || {};

        if (!(this instanceof ElevationPath)) {
            throw new TypeError("ERROR CLASS_CONSTRUCTOR");
        }

        /** Nom de la classe (heritage) */
        this.CLASSNAME = "ElevationPath";

        /** uuid */
        this._uid = ID.generate();

        /** container : HTMLElement */
        this._showContainer = null;
        this._pictoContainer = null;
        this._panelContainer = null;
        this._profilContainer = null;
        this._waitingContainer = null;

        /** objet de type "ol.style" */
        this._drawStyleStart = null;
        this._drawStyleFinish = null;
        this._markerStyle = null;

        /** graph */
        this._profil = null;

        /** objet de type
            "ol.source.Vector",
            "ol.layer.Vector",
            "ol.interaction.Draw"
        */
        this._measureSource = null;
        this._measureVector = null;
        this._measureDraw = null;

        /** objet de type ol.feature, saisie en cours */
        this._lastSketch = null;
        this._currentSketch = null;

        /** objet de type ol.feature, marker */
        this._marker =  null;

        /** gestion des droits sur le service */
        this._noRightManagement = false;

        // initialisation du composant
        this._initialize(options);

        // gestion des droits
        this._checkRightsManagement();

        // creation du DOM container
        var container = ( options.element ) ? options.element : this._initializeContainer();

        // heritage
        ol.control.Control.call(this,
            {
                element : container,
                target : options.target,
                render : options.render
            }
        );
    }

    // heritage avec ol.control.Control
    ol.inherits(ElevationPath, ol.control.Control);

    /**
     * @lends module:ElevationPath
     */
    ElevationPath.prototype = Object.create(ol.control.Control.prototype, {});

    // on récupère les mixins de la classe "ElevationPathDOM"
    Utils.assign(ElevationPath.prototype, ElevationPathDOM);

    /** styles by default */
    ElevationPath.DEFAULT_STYLES = {
        DRAW : {
            START : {
                fillColor : "rgba(0, 183, 152, 0.2)",
                strokeColor : "#002A50",
                strokeLineDash : [10, 10],
                strokeWidth : 2,
                imageRadius : 5,
                imageFillColor :  "rgba(255, 155, 0, 0.7)",
                imageStrokeColor : "#002A50",
                imageStrokeWidth : 2
            },
            FINISH : {
                fillColor : "rgba(0, 183, 152, 0.3)",
                strokeColor : "#002A50",
                strokeWidth : 3
            }
        },
        MARKER : {
            imageSrc : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAsCAYAAAAATWqyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABTtJREFUeNq8WGtsFUUU/rb3gtdCAykFG9AUDTQUKimhxUewEusrJYoBo4FfEgoqotHERH6oP9TGmJhIrIlWAf9hjAaEiME2pgFfVVpFii8sWqIQLLSx3EJLW7p+Z2Z2b2l7d/b23vZLTmZ2duacb2fmnDk7DlKA67rXs1hJKacsohRQppjXFygnKT9TDlH2O47zFzIFGnco91EOuqnjoBnr2Ow4FhIlLN6m3DykFTh3BGj/Doj/CfSe082xPCDnBmDWTUBeyXDVjZTHOUNHUiZCEs+weI0ySTV0/w0c2wa07gIungn+vOx8YN46oPhpYOp1Xms/5TmSeSMUERKImFnYqBoGuPRNL5LEW8BgX2rrmjWZZLYApS8BUW8r4T0zO5eTEjFr+S6lSjV0HgPqVwNdf6S30abNB+7aDeQWey3bKZtIxvU5DxvyrE/izJfAvuXpkxCIDtElOjWqjK2RM8LZWMbiG0oEnUc5kB7a14WMYvI04H56du5ieZKluZWz8r0/IyQh5TuKRH8cqFuTeRIC0Sm6xYbYok1j21+ahyhLVO3wC8D5VowbRLfY0FhibOulIavDLEoRZyD8sJDeMWBXKG5ZsIobsdDsg+OMq3u1m1u9KQo8zP45EqjRxOUpk6i50IRl4FuGjpZtwUoiMYa314GFj/EzIsN8n8v+C1e4kfvwcm+wnhsZY27xQ8oiWZpKrWRQB6tAElfxpKnjsCdGklDzG9HvpI/0DYLYEpsalVnmAAM6fgR62oMHl70C5N9mn3rpI32DILbEpkZ5ljlFgbPNFtebzij5VPhNKX1lTBASNtXSzPZ3cxCuvVOH7FTCu4yxeZDGbCES0z5+PniQ3uGpwTYmYTOWCPGTpgYP6u9OnYhtzBCbQkSH0NiM4EEdP6VOxDYmYbNLiJxQ1elFwYPaG3XQCn3QHddjgpCweUKI6K2bvzw4YROf//rJob6fZl/H2FRoFiINfqo3qyzYwD8MVIeYLw32J+8j76SP9A2C2BKbGg1CZL+EF/W4YKP9a3/fCeyhkrY9DOOXEu1SlzZ5J31sSNjqURm/OfQkY9qgvkYOvXhbuH0g505Oga7HT9rPF9+t5+pDL0ulwzt46FV5ROax+JUSRRtP0LoHMK64+xNg7iqVEVOKSKRVxRGpsKhRnaRD4SPjR0J0axKCGmP7ilQxm4X8d8xXmfvHJZlPkCR3WfODl9FLMlxCIhevSJ5Nwzo1XdKxYpe3hpmB6BKdmoS43VqPxIgsni+aWOg8biZ3f+nLmSMiuvKWek/P01az7QdLyNVT7lC/l59WAKcb0iMxhzpW1nvmvpDtSiKD1l9OkpnDgv8UyMWFU9wvTP8vdY6NhJwnD1JVtso2OiiLSeL0iJUbNfg6zikVVwRTyOn2HWOfjfLtHgnBhtFIJCViyNDZUatdmnGlaFPqJIoe1WM1aqlz71ivJbLNobgAA9zgu7nZ/vstHAk5WVdzaPRqmGC5lER6kjpV4OWJdq+1kkshSk4VH9izcy/bV66qSPQZV+0J9G7rTY6+XNmqHmYwyJVV24kse1X31dhKHdasygkzy+a64oC4nWr47F4e858nSbLv4V/KAe9JKpVDrx/SImLIXMOiRUKdujESl+49O8xVZxpXzVc/C/I/RxL/hgq8YYkYhev9q6kVO4d9B+sr3vdICNaHJTHWW8Ya/87wqy2uWwstUk/gTYw3aCRGOarMDfS67kfFWqSuIe9imAjQEC272nJHixYNaSvGRIIGN49ywbsZEw1zI11N6TZSHeaGORn+F2AAJtRIMx4t+hUAAAAASUVORK5CYII=",
            imageSize : [34, 44],
            imageAnchor : [0.5, 1],
            imageAnchorOrigin : "bottom-left",
            imageAnchorXUnits : "ratio",
            imageAnchorYUnits : "ratio",
            imageSnapToPixel : true
        },
        GRAPH : {}
    };

    /**
     * Constructor (alias)
     * @private
     */
    ElevationPath.prototype.constructor = ElevationPath;

    // ################################################################### //
    // ##################### public methods ############################## //
    // ################################################################### //

    /**
     * Overwrite OpenLayers setMap method
     *
     * @param {ol.Map} map - Map.
     */
    ElevationPath.prototype.setMap = function (map) {
        logger.trace("ElevationPath::setMap");

        // on appelle la méthode setMap originale d'OpenLayers
        ol.control.Control.prototype.setMap.call(this, map);

        if ( map ) {
            // activation des interactions de dessin selon la valeur de
            // l'option collapsed
            if (!this.options.collapsed) {
                // on n'affiche pas la fenetre de profil s'il n'existe pas...
                if (this._profil === null) {
                    this._panelContainer.style.display = "none";
                }
                this._initMeasureInteraction();
                this._addMeasureInteraction();
            }
        }

    };

    /**
     * Returns true if widget is collapsed (minimized),
     * false otherwise
     *
     * @returns {Boolean} collapsed - true if widget is collapsed
     */
    ElevationPath.prototype.getCollapsed = function () {
        logger.trace("ElevationPath::getCollapsed");
        return this.options.collapsed;
    };

    /**
     * TODO Collapse or display widget main container
     *
     * @param {Boolean} collapsed - true to collapse widget, false to display it
     */
    ElevationPath.prototype.setCollapsed = function (collapsed) {
        logger.trace("ElevationPath::setCollapsed");
        this.options.collapsed = collapsed;
        // TODO gestion du clic d'ouverture/fermeture du panneau du profil...
    };

    /**
     * Clear
     */
    ElevationPath.prototype.clear = function () {
        logger.trace("ElevationPath::clear");

        // graph
        this._profil = null;

        // on vide le container
        if (this._profilContainer) {
            while (this._profilContainer.firstChild) {
                this._profilContainer.removeChild(this._profilContainer.firstChild);
            }
        }

        // sketch
        this._lastSketch = null;
        this._currentSketch = null;

        // marker
        if (this._marker) {
            this._measureSource.removeFeature(this._marker);
            this._marker = null;
        }

        var _features = this._measureSource.getFeatures();
        for (var i = 0; i < _features.length; i++) {
            this._measureSource.removeFeature(_features[i]);
        }

        this._removeMeasureInteraction();
    };

    // ################################################################### //
    // ##################### init component ############################## //
    // ################################################################### //

    /**
     * Initialize control (called by constructor)
     *
     * @private
     */
    ElevationPath.prototype._initialize = function (options) {
        logger.trace("ElevationPath::_initialize : ", options);

        // liste des options
        this.options = {};

        // cle API sur le service
        this.options.apiKey = options.apiKey;

        // gestion du mode collapsed
        var collapsed = options.collapsed;
        this.options.collapsed = ( typeof collapsed === "undefined") ? true : collapsed;

        // gestion des options du Services
        var service = options.elevationOptions;
        this.options.service = ( typeof service === "undefined" || Object.keys(service).length === 0 ) ? {} : service;

        // gestion des styles
        var styles = options.stylesOptions || {};
        if ( typeof styles === "undefined" || Object.keys(styles).length === 0 ) {
            // on applique les styles par defaut
            this.options.styles = {
                draw : ElevationPath.DEFAULT_STYLES.DRAW,
                marker : ElevationPath.DEFAULT_STYLES.MARKER,
                graph : ElevationPath.DEFAULT_STYLES.GRAPH
            };
        }

        if ( typeof this.options.styles === "undefined") {
            this.options.styles = {};
        }

        // gestion des styles du tracé
        var draw = styles.draw || this.options.styles.draw;
        this.options.styles.draw = ( typeof draw === "undefined" || Object.keys(draw).length === 0 ) ?
            ElevationPath.DEFAULT_STYLES.DRAW : draw;
        var drawStart  = this.options.styles.draw.start;
        var drawFinish = this.options.styles.draw.finish;
        if ( typeof drawStart === "undefined" ) {
            this.options.styles.draw.start = ElevationPath.DEFAULT_STYLES.DRAW.START;
        }
        if ( typeof drawFinish === "undefined" ) {
            this.options.styles.draw.finish = ElevationPath.DEFAULT_STYLES.DRAW.FINISH;
        }
        this._createStylingDraw();

        // gestion des styles du marker
        var marker = styles.marker || this.options.styles.marker;
        this.options.styles.marker = ( typeof marker === "undefined" || Object.keys(marker).length === 0 ) ?
            ElevationPath.DEFAULT_STYLES.MARKER : marker;
        this._createStylingMarker();

        // gestion des styles du profil
        var graph = styles.graph || this.options.styles.graph;
        this.options.styles.graph = ( typeof graph === "undefined" || Object.keys(graph).length === 0 ) ?
            ElevationPath.DEFAULT_STYLES.GRAPH : graph;
        this._createStylingGraph();

    };

    /**
     * initialize component container (DOM)
     *
     * @private
     */
    ElevationPath.prototype._initializeContainer = function () {
        logger.trace("ElevationPath::_initializeContainer : ", this._uid);

        // create main container
        var container = this._createMainContainerElement();

        var inputShow = this._showContainer = this._createShowElevationPathElement();
        container.appendChild(inputShow);

        // mode "collapsed"
        if (!this.options.collapsed) {
            this._showContainer.checked = true;
        }

        var picto = this._pictoContainer = this._createShowElevationPathPictoElement();
        container.appendChild(picto);

        // panneau
        var panel = this._panelContainer = this._createElevationPathPanelElement();

        // header
        var header = this._createElevationPathPanelHeaderElement();
        panel.appendChild(header);

        // profil
        var profil = this._profilContainer = this._createElevationPathPanelProfilElement();
        panel.appendChild(profil);

        // waiting
        var waiting = this._waitingContainer = this._createElevationPathWaitingElement();
        panel.appendChild(waiting);

        container.appendChild(panel);

        return container;
    };

    /**
     * this method is called by constructor (into method _initialize())
     * and check the rights to resources
     *
     * @private
     */
    ElevationPath.prototype._checkRightsManagement = function () {
        logger.trace("ElevationPath::_checkRightsManagement");

        var rightManagement = RightManagement.check({
            key : this.options.apiKey,
            resources : ["SERVICE_CALCUL_ALTIMETRIQUE_RSC"],
            services : ["Elevation"]
        });

        if ( !rightManagement ) {
            this._noRightManagement = true;
        }

        // on recupère les informations utiles
        // sur ce controle, on ne s'occupe pas de la ressource car elle est unique...
        // Ex. la clef API issue de l'autoconfiguration si elle n'a pas
        // été renseignée.
        if ( !this.options.apiKey ) {
            this.options.apiKey = rightManagement.key;
        }

    };

    // ################################################################### //
    // ###################### init styles ################################ //
    // ################################################################### //

    /** create style marker object : "ol.style.icon" */
    ElevationPath.prototype._createStylingMarker = function () {
        logger.trace("ElevationPath::_createStylingMarker ");

        // on interprete les params pour y creer un objet ol.Style
        var styles = this.options.styles.marker;

        logger.trace("style marker", styles);

        var defaultStyle = ElevationPath.DEFAULT_STYLES.MARKER;
        Object.keys(defaultStyle).forEach(function (key) {
            if (!styles.hasOwnProperty(key)) {
                styles[key] = defaultStyle[key];
                return;
            }
        },this);

        // FIXME on se limite à qqch de simple sur la gestion des Icones
        this._markerStyle = new ol.style.Style({
            image : new ol.style.Icon({
                src : styles.imageSrc,
                // size : styles.imageSize,
                // imgSize :  styles.imageImgSize,
                anchor : styles.imageAnchor,
                // anchorOrigin : styles.imageAnchorOrigin,
                // anchorXUnits : styles.imageAnchorXUnits,
                // anchorYUnits : styles.imageAnchorYUnits,
                snapToPixel : true
            })
        });
    };

    /** create style draw object : "ol.style" */
    ElevationPath.prototype._createStylingDraw = function () {
        logger.trace("ElevationPath::_createStylingDraw");

        // on interprete les params pour y creer un objet ol.Style
        var styles = this.options.styles.draw;
        var start  = styles.start;
        var finish = styles.finish;

        logger.trace("style start",  start);
        logger.trace("style finish", finish);

        var defaultStyleStart = ElevationPath.DEFAULT_STYLES.DRAW.START;
        Object.keys(defaultStyleStart).forEach(function (key) {
            if (!start.hasOwnProperty(key)) {
                start[key] = defaultStyleStart[key];
                return;
            }
            if (key === "strokeWidth") {
                var intValue = parseInt(start[key],10);
                if (isNaN(intValue) || intValue < 0) {
                    console.log("Wrong value (" + start[key] + ") for strokeWidth. Must be a positive interger value." );
                    start[key] = defaultStyleStart[key];
                    return;
                }
                start[key] = intValue;
            }
        },this);

        // surface : fill
        var _fill = new ol.style.Fill({
            color : start.fillColor
        });

        // ligne : stroke
        var _stroke = new ol.style.Stroke({
            color : start.strokeColor,
            lineDash : start.strokeLineDash,
            width : start.strokeWidth
        });

        // point : image
        var _image = new ol.style.Circle({
            radius : start.imageRadius,
            stroke : new ol.style.Stroke({
                color : start.imageStrokeColor,
                width : start.imageStrokeWidth
            }),
            fill : new ol.style.Fill({
                color : start.imageFillColor
            })
        });

        this._drawStyleStart = new ol.style.Style({
            fill : _fill,
            stroke : _stroke,
            image : _image
        });

        var defaultStyleFinish = ElevationPath.DEFAULT_STYLES.DRAW.FINISH;
        Object.keys(defaultStyleFinish).forEach(function (key) {
            if (!finish.hasOwnProperty(key)) {
                finish[key] = defaultStyleFinish[key];
                return;
            }
            if (key === "strokeWidth") {
                var intValue = parseInt(finish[key],10);
                if (isNaN(intValue) || intValue < 0) {
                    console.log("Wrong value (" + finish[key] + ") for strokeWidth. Must be a positive interger value." );
                    finish[key] = defaultStyleFinish[key];
                    return;
                }
                finish[key] = intValue;
            }
        },this);

        this._drawStyleFinish = new ol.style.Style({
            fill : new ol.style.Fill({
                color : styles.finish.fillColor
            }),
            stroke : new ol.style.Stroke({
                color : styles.finish.strokeColor,
                lineDash : styles.finish.strokeLineDash,
                width : styles.finish.strokeWidth
            })
        });

    };

    /** TODO create style graph */
    ElevationPath.prototype._createStylingGraph = function () {
        logger.trace("ElevationPath::_createStylingGraph");
    };

    // ################################################################### //
    // ################### Map interactions management ################### //
    // ################################################################### //

    /**
    * this method is called by this.onShowElevationPathClick,
    * and initialize a vector layer, if widget is not collapsed.
    *
    * @private
    */
    ElevationPath.prototype._initMeasureInteraction = function () {
        logger.trace("ElevationPath::_initMeasureInteraction()");

        var map = this.getMap();
        if (!map) {
            return;
        }

        this._measureSource = new ol.source.Vector();

        this._measureVector = new ol.layer.Vector({
            source : this._measureSource,
            style : this._drawStyleFinish
        });

        map.addLayer(this._measureVector);
    };

    /**
    * this method is called by this.onShowElevationPathClick,
    * and add draw interaction to map, if widget is not collapsed.
    *
    * @private
    */
    ElevationPath.prototype._addMeasureInteraction = function () {
        logger.trace("ElevationPath::_addMeasureInteraction()");

        var map = this.getMap();
        if (!map) {
            return;
        }

        // Creates and adds the interaction
        this._measureDraw = new ol.interaction.Draw({
            source : this._measureSource,
            type : "LineString",
            style : this._drawStyleStart
        });

        map.addInteraction(this._measureDraw);

        // Event start
        var self = this;
        this._measureDraw.on("drawstart", function (evt) {
            logger.trace(evt);

            // delete marker current
            if (self._marker !== null) {
                self._measureSource.removeFeature(self._marker);
                self._marker = null;
            }

            // set new feature and remove last feature
            if (self._lastSketch !== null) {
                self._measureSource.removeFeature(self._lastSketch);
                self._lastSketch = null;
            }
            self._currentSketch = evt.feature;

            // and, all features
            var _features = self._measureSource.getFeatures();
            for (var i = 0; i < _features.length; i++) {
                self._measureSource.removeFeature(_features[i]);
            }

        }, this);

        // Event end
        this._measureDraw.on("drawend", function (evt) {
            logger.trace(evt);

            // set feature
            self._lastSketch = self._currentSketch;

            // set an alti request and display results
            self._pictoContainer.style.display = "none";
            self._panelContainer.style.display = "block";
            self._requestService();
        }, this);
    };

    /**
    * this method is called by this.onShowElevationPathClick,
    * and removes draw interaction from map (if exists)
    * And removes layer too...
    *
    * @private
    */
    ElevationPath.prototype._removeMeasureInteraction = function () {
        logger.trace("ElevationPath::_removeMeasureInteraction()");

        var map = this.getMap();
        if (!map) {
            return;
        }

        if (this._measureVector) {
            map.removeLayer(this._measureVector);
            this._measureVector = null;
        }

        if (this._measureDraw) {
            map.removeInteraction(this._measureDraw);
            this._measureDraw = null;
        }
    };

    // ################################################################### //
    // ############################ Alti request ######################### //
    // ################################################################### //

    /**
    * transforme geometry feature to position coordinate (service)
    *
    * @private
    */
    ElevationPath.prototype._getGeometry = function () {

        // INFO
        // on transmet toujours des coordonnées au service en EPSG:4326

        if (this._currentSketch === null) {
            logger.warn("Current Feature undefined !?");
            return;
        }

        var geometry = [];

        var map  = this.getMap();
        var projSrc  = map.getView().getProjection();
        var projDest = "EPSG:4326";
        var geom = this._currentSketch.getGeometry().getCoordinates();
        for (var i = 0; i < geom.length; i++) {
            var xy = geom[i];
            var ll = xy;
            // on transmet au service des coordonnées en EPSG:4326
            if (projSrc !== projDest) {
                ll = ol.proj.transform(xy, projSrc, projDest);
            }
            geometry.push({
                lon : ll[0],
                lat : ll[1]
            });
        }

        return geometry;
    };

    /**
    * this method is called at the end of the path,
    * it generates and sends alti request, then displays results
    *
    * @private
    */
    ElevationPath.prototype._requestService = function () {
        logger.trace("ElevationPath::_requestService");

        // les coordonnées sont obligatoires
        var geometry = this._getGeometry();
        logger.trace("geometry", geometry);
        if ( ! geometry ) {
            logger.warn("missing geometry !?");
            return;
        }

        // oups, aucun droits !
        if (this._noRightManagement) {
            logger.warn("no rights to this service !");
            return;
        }

        // on construit les options pour la requête
        var options = {};

        // on surcharge avec les options de l'utilisateur
        Utils.mergeParams(options, this.options.service);

        // au cas où ...
        Utils.mergeParams(options, {
            apiKey : this.options.apiKey
        });

        // les callbacks
        var self = this;

        /** callback _requestServiceOnSuccess */
        var _requestServiceOnSuccess = function (result) {
            logger.trace(result);
            if (result) {
                self._displayProfil(result.elevations);
                self._waitingContainer.className = "GPelevationPathCalcWaitingContainerHidden";
                self._waiting = false;
            }
        };

        /** callback _requestServiceOnFailure */
        var _requestServiceOnFailure = function (error) {
            logger.error(error.message);
            self._waitingContainer.className = "GPelevationPathCalcWaitingContainerHidden";
            self._waiting = false;
        };

        Utils.mergeParams(options, {
            onSuccess : _requestServiceOnSuccess,
            onFailure : _requestServiceOnFailure
        });

        // le sampling
        var sampling = options.sampling;
        if (!sampling) {
            Utils.mergeParams(options, {
                sampling : options.sampling || 200
            });
        }

        // et enfin, la geometrie
        Utils.mergeParams(options, {
            positions : geometry
        });

        logger.trace("options du service", options);

        // mise en place de la patience
        this._waitingContainer.className = "GPelevationPathCalcWaitingContainerVisible";

        // Request altitude service
        Gp.Services.getAltitude(options);
    };

    // ################################################################### //
    // ########################## Profil display ######################### //
    // ################################################################### //

    /**
    * this method is called after service request (in case of success)
    * and display results
    *
    * @param {Array} elevations - array of elevation
    * @private
    */
    ElevationPath.prototype._displayProfil = function (elevations) {
        logger.trace("ElevationPath::_displayProfil", elevations);

        var wgs84Sphere = new ol.Sphere(6378137);

        // Calcul de la distance au départ pour chaque point + arrondi des lat/lon
        elevations[0].dist = 0;
        var distance = 0;
        for (var i = 1; i < elevations.length; i++) {
            distance += (wgs84Sphere.haversineDistance([elevations[i].lon, elevations[i].lat], [elevations[i - 1].lon, elevations[i - 1].lat])) / 1000;
            elevations[i].dist = distance;
            elevations[i].lat = Math.round(elevations[i].lat * 10000) / 10000;
            elevations[i].lon = Math.round(elevations[i].lon * 10000) / 10000;
        }

        // Valeur du coeff d'arrondi des distances en fonction de la distance totale
        var coeffArrond = 100;
        if (distance > 100) {
            coeffArrond = 1;
        } else if (distance > 10) {
            coeffArrond = 10;
        }

        // Correction des altitudes aberrantes + arrondi des calculs de distance
        for (var j = 0; j < elevations.length; j++) {
            var data = elevations[j];
            if (data.z < 0) {
                data.z = 0;
            }
            data.dist = Math.round(data.dist * coeffArrond) / coeffArrond;
        }

        // Calcul du profil
        if ( typeof AmCharts !== "undefined" ) {
            // AmCharts, it's a variable global because i do the choice to put it on lib. external !
            console.log("Lib. AmCharts is loaded !");
            this._displayProfilWithAmCharts(elevations);

        } else if ( typeof d3 !== "undefined" ) {
            console.log("Lib. D3 is loaded !");
            this._displayProfilWithD3(elevations);

        } else {
            console.log("No library is loaded !");
            this._displayProfilResults(elevations);

        }
    };

    /**
    * display profil with simple results of service
    * TODO CSS externe pour id=profilElevationResults
    * TODO Style des points du profil
    *
    * @param {Array} data - array of elevation
    * @private
    */
    ElevationPath.prototype._displayProfilResults = function (data) {
        logger.trace("ElevationPath::_displayProfilResults", data);

        var container = this._profilContainer;

        // on nettoie toujours...
        if (container) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }

        // TODO CSS externe
        var div  = document.createElement("textarea");
        div.id = "profilElevationResults";
        div.rows = 10;
        div.cols = 50;
        div.style.width = "100%";
        div.innerHTML = JSON.stringify(data, undefined, 4);
        container.appendChild(div);

        this._profil = container;

        // symbolisation des points produits par le service
        var _proj = this.getMap().getView().getProjection();
        for (var i = 0; i < data.length; i++) {
            var obj = data[i];
            var _coordinate = ol.proj.transform([obj.lon, obj.lat], "EPSG:4326", _proj);
            var _geometry   = new ol.geom.Point(_coordinate);

            this._marker = new ol.Feature({
                geometry : _geometry
            });
            logger.trace(_geometry);

            // TODO style en options ?
            var _image = new ol.style.Circle({
                radius : 5,
                stroke : new ol.style.Stroke({
                    color : "rgba(0, 0, 0, 0.7)",
                    width : 2
                }),
                fill : new ol.style.Fill({
                    color : "rgba(128, 128, 128, 0.2)"
                })
            });
            this._marker.setStyle(new ol.style.Style({
                image : _image
            }));

            // ajout du marker sur la map
            this._measureSource.addFeature(this._marker);
        }

    };

    /**
    * TODO display graphical profil with lib. D3
    *
    * @param {Array} data - array of elevation
    * @private
    */
    ElevationPath.prototype._displayProfilWithD3 = function (data) {
        logger.trace("ElevationPath::_displayProfilWithD3", data);
    };

    /**
    * display graphical profil with lib.AmCharts
    * TODO gestion des styles utilisateurs !
    *
    * @param {Array} data - array of elevation
    * @private
    */
    ElevationPath.prototype._displayProfilWithAmCharts = function (data) {
        logger.trace("ElevationPath::_displayProfilWithAmCharts", data);

        AmCharts.addInitHandler(function () {
            logger.trace("AmCharts::addInitHandler (event)");
        });

        // FIXME a ton besoin de nettoyer les listiners sur AmCharts ?
        // if (this._profil) {
        //     AmCharts.removeListener(this._profil, "changed", _onFollowProfilPathChanged);
        // }

        this._profil = AmCharts.makeChart( this._profilContainer, {
            type : "serial",
            pathToImages : "http://cdn.amcharts.com/lib/3/images/",
            categoryField : "dist",
            autoMarginOffset : 0,
            marginRight : 10,
            marginTop : 10,
            startDuration : 0,
            color : "#5E5E5E",
            fontSize : 10,
            theme : "light",
            thousandsSeparator : "",
            categoryAxis : {
                color : "#5E5E5E",
                gridPosition : "start",
                minHorizontalGap : 40,
                tickPosition : "start",
                title : "Distance (km)",
                titleColor : "#5E5E5E",
                startOnAxis : true
            },
            chartCursor : {
                animationDuration : 0,
                bulletsEnabled : true,
                bulletSize : 10,
                categoryBalloonEnabled : false,
                cursorColor : "#F90",
                graphBulletAlpha : 1,
                graphBulletSize : 1,
                zoomable : false
            },
            trendLines : [],
            graphs : [
                {
                    balloonColor : "#CCCCCC",
                    balloonText : "<span class='altiPathValue'>[[title]] : [[value]]m</span><br/><span class='altiPathCoords'>(lat: [[lat]] / lon:[[lon]])</span>",
                    bullet : "round",
                    bulletAlpha : 0,
                    bulletBorderColor : "#FFF",
                    bulletBorderThickness : 2,
                    bulletColor : "#F90",
                    bulletSize : 6,
                    hidden : false,
                    id : "AmGraph-1",
                    fillAlphas : 0.4,
                    fillColors : "#C77A04",
                    lineAlpha : 1,
                    lineColor : "#C77A04",
                    lineThickness : 1,
                    title : "Altitude",
                    valueField : "z"
                }
            ],
            guides : [],
            valueAxes : [
                {
                    id : "ValueAxis-1",
                    minVerticalGap : 20,
                    title : "Altitude (m)"
                }
            ],
            allLabels : [],
            balloon : {
                borderColor : "#CCCCCC",
                borderThickness : 1,
                fillColor : "#FFFFFF",
                showBullet : true
            },
            titles : [],
            dataProvider : data
        });

        var self = this;
        /** _onFollowProfilPathChanged */
        var _onFollowProfilPathChanged = function (e) {
            logger.trace("AmCharts::changed (event)", e);
            var obj = e.chart.dataProvider[e.index];
            logger.trace(obj);

            var _proj = self.getMap().getView().getProjection();
            var _coordinate = ol.proj.transform([obj.lon, obj.lat], "EPSG:4326", _proj);
            var _geometry   = new ol.geom.Point(_coordinate);

            // suppression de l'ancien marker
            if (self._marker) {
                self._measureSource.removeFeature(self._marker);
                self._marker = null;
            }

            self._marker = new ol.Feature({
                geometry : _geometry
            });
            logger.trace(_geometry);

            // style
            self._marker.setStyle(self._markerStyle);

            // ajout du marker sur la map
            self._measureSource.addFeature(self._marker);
        };

        this._profil.addListener("changed", _onFollowProfilPathChanged);

    };

    // ################################################################### //
    // ####################### handlers events to dom #################### //
    // ################################################################### //

    /**
    * this method is called by event 'click' on '' picto
    * and enable or disable the entry of the path
    * TODO prévoir un nettoyage à la fermeture
    *
    * @private
    */
    ElevationPath.prototype.onShowElevationPathClick = function () {

        // Activation/Desactivation des interactions de dessins
        if (!this._showContainer.checked) {
            // on n'affiche pas la fenetre de profil s'il n'existe pas...
            if (this._profil === null) {
                this._panelContainer.style.display = "none";
            }
            this._initMeasureInteraction();
            this._addMeasureInteraction();
        } else {
            this._pictoContainer.style.display = "block";
            this._panelContainer.style.display = "none";
            this._removeMeasureInteraction();
            this.clear();
        }
    };

    return ElevationPath;
});
