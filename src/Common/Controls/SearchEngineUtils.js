define([], function () {

    "use strict";

    var SearchEngineUtils = {
        advancedSearchFiltersByDefault : {
            PositionOfInterest : [
                {
                    name : "importance",
                    title : "Importance"
                },
                {
                    name : "nature",
                    title : "Nature"
                },
                {
                    name : "territory",
                    title : "Territoire"
                },
                {
                    name : "insee",
                    title : "Code INSEE"
                },
                {
                    name : "municipality",
                    title : "Ville"
                },
                {
                    name : "department",
                    title : "Département"
                }
            ],
            StreetAddress : [
                // INFO
                // ce ne sont pas des filtres mais une location dite structurée !
                // {name : "number", title : "Numéro"},
                // {name : "street", title : "Rue"},
                // {name : "postalCode", title : "Code Postal"},
                // {name : "city", title : "Commune"},
                {
                    name : "territory",
                    title : "Territoire"
                },
                {
                    name : "insee",
                    title : "Code INSEE"
                },
                {
                    name : "municipality",
                    title : "Ville"
                },
                {
                    name : "department",
                    title : "Département"
                }
            ],
            CadastralParcel : [
                {
                    name : "department",
                    title : "Département",
                    description : "Numéro du département (ex: 01, 94)"
                },
                {
                    name : "commune",
                    title : "Code commune (INSEE)",
                    description : "Code commune (INSEE) : 3 chiffres (ex: 067)"
                },
                // {
                //     name : "insee",
                //     title : "Code INSEE"
                // },
                {
                    name : "absorbedCity",
                    title : "Commune absorbée",
                    description : "Commune absorbée : 3 chiffres (ex: 000, 001)"
                },
                {
                    name : "section",
                    title : "Section",
                    description : "Section : 2 caractères (ex: AA, 0D)"
                },
                {
                    name : "number",
                    title : "Numéro",
                    description : "Numéro de la parcelle : 4 chiffres (ex: 0041, 0250)"
                }
            ],
            Administratif : [
                {
                    name : "prefecture",
                    title : "Préfecture"
                },
                {
                    name : "inseeRegion",
                    title : "Code région (INSEE)"
                },
                {
                    name : "inseeDepartment",
                    title : "Code département (INSEE)"
                },
                {
                    name : "municipality",
                    title : "Ville"
                }
            ]
        }
    };

    return SearchEngineUtils;

});
