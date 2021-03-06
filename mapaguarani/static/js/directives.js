(function(angular, L, _) {
  'use strict';

  var directives = angular.module('mapaguarani.directives', []);

  /*
   * Lock sidebar height to proper site grid limits
   */
  directives.directive('sidebarHeight', [
    function() {
      return {
        restrict: 'A',
        scope: {
          sidebarHeight: '='
        },
        link: function(scope, element, attrs) {
          scope.$watch('sidebarHeight', function(apply) {
            doHeight(apply);
          });
          function doHeight(apply) {
            if(apply) {
              var height = $('#sidebar').height() - (57*4) - 64;
              $(element).height(height).addClass('active');
            } else {
              $(element).height(0).removeClass('active');;
            }
          }
        }
      }
    }
  ]);

  /*
   * Store map layers
   */
  var gm_roadmap = new L.gridLayer.googleMutant({type: 'roadmap', pane: 'base_tiles'});
  var gm_terrain = new L.gridLayer.googleMutant({type: 'terrain', pane: 'base_tiles'});
  var gm_hybrid = new L.gridLayer.googleMutant({type: 'hybrid', pane: 'base_tiles'});
  var gm_satellite = new L.gridLayer.googleMutant({type: 'satellite', pane: 'base_tiles'});

  var access_token = 'pk.eyJ1IjoiYnJ1bm9zbWFydGluIiwiYSI6IjM1MTAyYTJjMWQ3NmVmYTg0YzQ0ZWFjZTg0MDZiYzQ3In0.ThelegmeGkO5Vwd6KTu6xA';
  var mapbox_url = 'http://api.tiles.mapbox.com/v4/{mapid}/{z}/{x}/{y}.png?access_token={access_token}';
  var mapbox_satellite = L.tileLayer(mapbox_url, {mapid: 'mapbox.satellite', access_token: access_token, pane: 'base_tiles'});
  var mapbox_streets   = L.tileLayer(mapbox_url, {mapid: 'mapbox.streets', access_token: access_token, pane: 'base_tiles'});
  var mapbox_hybrid   = L.tileLayer(mapbox_url, {mapid: 'mapbox.streets-satellite', access_token: access_token, pane: 'base_tiles'});

  // Official layers
  var ProtectedAreaTileOptions = {
    pane: 'base_tiles',
    vectorTileLayerStyles: {
      lands: function(properties, zoom) {
        var styles = {
            weight: 2,
            fillColor: '#74c476',
            color: '#74c476',
            fillOpacity: 0.4,
            opacity: 0.7,
            fill: true,
        };
        return styles
      },
    },
  };
  var protected_areas_tile = L.vectorGrid.protobuf('tiles/protected_areas/{z}/{x}/{y}.pbf', ProtectedAreaTileOptions);

  var boundariesTilesOptions = {
    pane: 'base_tiles',
    vectorTileLayerStyles: {
      boundaries: function(properties, zoom) {
        var styles = {
            weight: 1,
            fillColor: '#fff',
            color: '#fff',
            fillOpacity: 0.4,
            opacity: 0.7,
            // fill: true,
            stroke: true,
        };
        return styles
      },
    },
  };

  var boundaries_cities_tile = L.vectorGrid.protobuf('tiles/cities/{z}/{x}/{y}.pbf', boundariesTilesOptions);
  var boundaries_states_tile = L.vectorGrid.protobuf('tiles/states/{z}/{x}/{y}.pbf', boundariesTilesOptions);
  var boundaries_countries_tile = L.vectorGrid.protobuf('tiles/countries/{z}/{x}/{y}.pbf', boundariesTilesOptions);

  /*
   * Loading message
   */
  directives.directive('loading', [
    '$rootScope',
    function($rootScope) {
      return {
        restrict: 'A',
        link: function(scope, element, attrs) {
          $rootScope.$on('mapaguarani.loaded', function() {
            angular.element(element).remove();
          });
        }
      }
    }
  ])

  /*
   * Sidebar list directive
   * Display and filter items
   */
  directives.directive('guaraniList', [
    '$rootScope',
    '$state',
    '$stateParams',
    'GuaraniService',
    'guaraniMapService',
    'user',
    'Villages',
    'EthnicGroups',
    'ProminentEthnicGroups',
    'LandTenures',
    function($rootScope, $state, $stateParams,
             Guarani, Map, user, Villages, EthnicGroups, ProminentEthnicGroups, LandTenures) {
      return {
        restrict: 'E',
        scope: {
          villages: '=',
          lands: '=',
          sites: '=',
          filtered: '='
        },
        templateUrl: '/static/views/partials/list.html',
        link: function(scope, element, attrs) {

          // Set current user
          scope.user = user;

          // function generate_urls(features, type) {
          //     angular.forEach(features, function(item){
          //         item.url = $state.href(type, {id: item.id}, {inherit: false});
          //     });
          //     return features;
          // }

          /*
           * Content type
           */
          scope.content = $stateParams.content || '';
          scope.setContent = function(content) {
            // if (content == 'villages' && scope[content] == undefined) {
            //   Villages.query({}, function(villages){
            //     scope.villages = generate_urls(villages, 'village');
            //   })
            // }
            scope.content = content;
            scope.curPage = 0;
          };

          scope.toggleContent = function(content) {
            if(scope.content == content) {
              scope.content = '';
            } else {
              scope.setContent(content);
            }
          }
          // Watch content to broacast change of value and clear filters
          scope.$watch('content', function(content, prevContent) {
            if(content !== prevContent) {
              $rootScope.$broadcast('mapaguarani.contentChanged', content);
              scope.filter.advanced = undefined;
              scope.showAdv = false;
            }
          });

          /*
           * Layer toggler
           */
          // Available layers, all enabled by default
          scope.activeLayers = {
            'villages': true,
            'lands': true,
            'sites': true
          };
          // Toggler
          scope.toggleLayer = function(layer) {
            if(scope.activeLayers[layer])
              scope.activeLayers[layer] = false;
            else
              scope.activeLayers[layer] = true;
            Map.toggleLayer(layer);
          };

          /*
           * Filters
           */
          scope.filtered = scope.filtered || {};
          scope.filtered.villages = [];
          scope.filtered.lands = [];
          scope.filtered.sites = [];
          scope._all = [];

          // Get every available content for "search all" results
          scope.getAll = function() {
            var all = [];
            if (scope.villages !== undefined)
                all = all.concat(angular.copy(scope.villages));
            if (scope.lands !== undefined)
                all = all.concat(angular.copy(scope.lands));
            if (scope.sites !== undefined)
                all = all.concat(angular.copy(scope.sites));
            return all;
          };

          // Watch village content changes for filterable collection
          scope.$watch('villages', function(villages) {
            if(typeof villages == 'object')
              scope.filtered.villages = angular.copy(villages);
          });

          // Watch lands content changes for filterable collection
          scope.$watch('lands', function(lands) {
            if(typeof lands == 'object')
              scope.filtered.lands = angular.copy(lands);
          });

          // Watch sites content changes for filterable collection
          scope.$watch('sites', function(sites) {
            if(typeof sites == 'object')
              scope.filtered.sites = angular.copy(sites);
          });

          // Watch all content changes to store `getAll` on scope
          scope.$watchGroup(['villages', 'lands', 'sites'], function() {
            scope._all = scope.getAll();
          });

          // Use state params defined filters
          if($stateParams.filter) {
            scope.filter = JSON.parse($stateParams.filter);
          } else {
            scope.filter = {};
          }
          // Watch filter changes to broadcast and reset paging
          scope.$watch('filter', function(filter, prevFilter) {
            if(filter !== prevFilter) {
              $rootScope.$broadcast('mapaguarani.filterChanged', filter);
              scope.curPage = 0;
            }
          }, true);

          /*
           * Advanced filters
           */

          scope.showAdv = scope.filter.advanced ? true : false;
          scope.toggleAdv = function() {
            if(scope.showAdv) {
              scope.showAdv = false;
              scope.filter.advanced = undefined;
            } else
              scope.showAdv = true;
          };

          /*
           * Config adv nav fields for each content type
           */
          scope.adv = {};
          scope.adv.villages = {
            guarani_presence: {
              name: 'Presença Guarani',
              ref: 'presence',
              label: 'name',
              options: [
                {presence: true, name: 'Sim'},
                {presence: false, name: 'Não'}
              ]
            },
            prominent_subgroup: {
              name: 'Subgrupo de destaque',
              ref: 'id',
              label: 'name',
              options: []
            }
          };
          ProminentEthnicGroups.query({}, function(prominent_ethnic_groups) {
            scope.adv.villages.prominent_subgroup.options = prominent_ethnic_groups;
          })

          scope.adv.lands = {
            ethnic_groups: {
              name: 'Grupos étnicos',
              ref: 'id',
              label: 'name',
              options: []
            },
            land_tenure: {
              name: 'Situação fundiária',
              ref: 'id',
              label: 'name',
              options: []
            }
          };
          LandTenures.query({}, function(tenures) {
            scope.adv.lands.land_tenure.options = tenures;
          })
          EthnicGroups.query({}, function(ethnic_groups) {
            scope.adv.lands.ethnic_groups.options = ethnic_groups;
          })

          /*
           * Paging
           */
          scope.perPage = attrs.perPage || 10;
          scope.curPage = (parseInt($stateParams.page)-1) || 0;

          scope.pageCount = function() {
            if(scope.filtered[scope.content] && scope.filtered[scope.content].length) {
              return Math.ceil(scope.filtered[scope.content].length/scope.perPage)-1;
            } else if(scope.filter.text) {
              return Math.ceil(scope.filtered.all.length/scope.perPage)-1;
            } else {
              return 0;
            }
          };
          scope.nextPage = function() {
            if(scope.curPage < scope.pageCount())
              scope.curPage++;
          }
          scope.prevPage = function() {
            if(scope.curPage > 0)
              scope.curPage--;
          }
          scope.$watch('curPage', function(page, prevPage) {

            if(page !== prevPage)
              $rootScope.$broadcast('mapaguarani.pageChanged', page);

            $(element).scrollTop(0);
            $(element).parent().scrollTop(0);
            $(element).parent().parent().scrollTop(0);
            $(element).parent().parent().parent().scrollTop(0);
          });

        }
      }
    }
  ]);

  /*
   * Single item directive
   */
  directives.directive('guaraniItem', [
    '$state',
    function($state) {
      return {
        restrict: 'EA',
        scope: {
          'item': '=',
        },
        templateUrl: '/static/views/partials/list-item.html',
      }
    }
  ]);

  /*
   * Map interaction service
   */
  directives.factory('guaraniMapService', [
    '$rootScope',
    function($rootScope) {
      var map;
      var layers = [];

      var cluster;

      return {
        setMap: function(m) {
          map = m;
          return map;
        },
        getMap: function() {
          return map;
        },
        addLayer: function(layer) {
          layers.push(layer);
        },
        toggleLayer: function(layer) {
          $rootScope.$broadcast('mapaguarani.toggleLayer', layer);
        },
        updateBounds: function() {
          if(map) {
            map.setView([-16.107747, -51.103348], 5);
          }
        }
      }
    }
  ]);

  /*
   * Map directive
   */
  directives.directive('guaraniMap', [
    'GuaraniService',
    'guaraniMapService',
    '$rootScope',
    '$http',
    '$state',
    '$stateParams',
    '$window',
    'LandTenures',
    // '$routeParams',
    function(Guarani, Map, $rootScope, $http, $state, $stateParams, $window, LandTenures) {
      return {
        restrict: 'E',
        scope: {
          center: '=',
          zoom: '='
        },
        link: function(scope, element, attrs) {
          var center = scope.center || [-16.107747, -51.103348];

          var default_zoom = 5.0;
          // if ($window.innerHeight < 500 || $window.innerWidth < 500 ) {
          //   default_zoom = 3.5;
          // } else
          if ($window.innerHeight < 900) {
            default_zoom = 4.0;
          }
          var zoom = scope.zoom || default_zoom;

          angular.element(element).append('<div id="' + attrs.id + '"></div>"').attr('id', '');

          var map = L.map(attrs.id, {
            center: center,
            zoomControl: false,
            attributionControl: false,
            preferCanvas: true,
            zoomSnap: 0.1,
            zoomDelta: 0.5,
            zoom: zoom,
          });

          // Store map leaflet object on map service
          Map.setMap(map);

          map.createPane('base_tiles');
          map.getPane('base_tiles').style.zIndex = 50;

          map.createPane('markers');
          map.getPane('markers').style.zIndex = 650;

          map.createPane('lands');
          map.getPane('lands').style.zIndex = 400;

          // Add base layers
          map.addLayer(gm_hybrid);
          var baselayers = {
            'Híbrido Google': gm_hybrid,
            'Satélite Google': gm_satellite,
            'Mapa Google': gm_roadmap,
            'Terreno Google': gm_terrain,
            'Híbrido Mapbox': mapbox_hybrid,
            'Satélite Mapbox': mapbox_satellite,
            'Mapa Mapbox': mapbox_streets
          };

          var official_layers = {
            'Áreas de proteção ambiental': protected_areas_tile,
            'Limites Municípios': boundaries_cities_tile,
            'Limites Estados': boundaries_states_tile,
            'Limites Países': boundaries_countries_tile
          };

          var layersControl = new L.Control.Layers(baselayers, official_layers, {'position': 'topleft'});
          map.addControl(layersControl);

          var zoomControl = new L.control.zoom({'position': 'topleft'});
          map.addControl(zoomControl);
          L.control.scale({'position':'bottomright','imperial':false }).addTo(map);;
          // Watch layer toggling to display legends
          map.on('layeradd', function(ev) {
            if(ev.layer.name && scope.interactiveLayers[ev.layer.name])
              map.addControl(scope.interactiveLayers[ev.layer.name].legend);
          });
          map.on('layerremove', function(ev) {
            if(ev.layer.name && scope.interactiveLayers[ev.layer.name])
              map.removeControl(scope.interactiveLayers[ev.layer.name].legend);
          });

          L.easyButton('fa-crosshairs fa-lg', function(btn, map) {
            window.navigator.geolocation.getCurrentPosition(function(position) {
              map.setView([position.coords.latitude, position.coords.longitude], 13);
            });
          }, 'Centralizar mapa na sua posição atual').addTo(map);

          var markerClick = function(ev, type) {
              if(ev.target && ev.target.feature && ev.target.feature.id) {
                $state.go(type, {id: ev.target.feature.id, focus: false});
              }
              // Stop event propagation to avoid triger click event on land.
              // Both ev.stopPropagation and ev.originalEvent.stopPropagation
              // doesn't work.
              L.DomEvent.stop(ev);
          };

          // Start interactive layers object (lands, sites and villages)
          scope.interactiveLayers = {};

          /*
           * Init Lands layer
           */
          var vectorTileStyling = {
            lands: function(properties, zoom) {
              var styles = {
                  weight: 2,
                  fillColor: properties.land_tenure_map_color,
                  color: '#c9d119',
                  fillOpacity: 0.7,
                  opacity: 0.7,
                  fill: true,
              };
              if (zoom >= 8)
              styles.weight = 3;
              if (zoom >= 10)
              styles.weight = 5;
              if (zoom >= 12)
              styles.fill = false;
              if (properties.land_tenure_status_dashed_border) {
                if (zoom >= 10)
                  styles.dashArray = '6, 9';
                else
                  styles.dashArray = '2, 2';
              }
              return styles
            }
          }
          var mapboxVectorTileOptions = {
            endererFactory: L.canvas.tile,
            vectorTileLayerStyles: vectorTileStyling,
            interactive: true,
            getFeatureId: function(feat) {
              return feat.properties.cti_id;
            },
            pane: 'lands',
          };
          var landstilesUrl = '/tiles/lands/{z}/{x}/{y}.pbf';
          var landsLayer = L.vectorGrid.protobuf(landstilesUrl, mapboxVectorTileOptions);

          landsLayer.on('click', function(ev) {
            if (ev.layer && ev.layer.properties)
              $state.go('land', {id: ev.layer.properties.cti_id, focus: false});
          });

          var landsLegend = L.control({'position': 'bottomright'});
          landsLegend.onAdd = function(map) {
            var div = L.DomUtil.create('div', 'info legend lands');
            div.innerHTML += '<p><strong>Terras indígenas</strong></p>';
            LandTenures.query(function(tenures) {
              var tenure_map = {};
              _.each(tenures, function(tenure) {
                tenure_map[tenure.name] = tenure.map_color
              });
              div.innerHTML += '<p><span class="bg-item" style="background-color:' + tenure_map['Sem providências'] + ';"></span> Sem providências</p>';
              div.innerHTML += '<p><span class="bg-item" style="background-color:' + tenure_map['Em estudo'] + ';"></span> Em estudo</p>';
              div.innerHTML += '<p><span class="bg-item" style="background-color:' + tenure_map['Delimitada'] + ';"></span> Delimitada</p>';
              div.innerHTML += '<p><span class="bg-item" style="background-color:' + tenure_map['Declarada'] + ';"></span> Declarada</p>';
              div.innerHTML += '<p><span class="bg-item" style="background-color:' + tenure_map['Homologada'] + ';"></span> Homologada ou Regularizada</p>';
              div.innerHTML += '<p class="divider"></p>';
              div.innerHTML += '<p><span class="bg-item" style="background-color:' + tenure_map['Em processo de desapropriação ou aquisição'] + ';"></span> Em processo de desapropriação ou aquisição</p>';
              div.innerHTML += '<p><span class="bg-item" style="background-color:' + tenure_map['Adquirida'] + ';"></span> Desapropriada ou Adquirida</p>';

              div.innerHTML += '<p class="divider"></p>' +
              '<p><span class="point-item legend1"></span> delimitadas, declaradas, homologadas ou desapropriadas/adquiridas</p>' +
              '<p><span class="point-item legend2"></span> em reestudo</p>' +
              '<p><span class="point-item legend3"></span> não delimitadas</p>';
            });
//            Guarani.tenures_status.query(function(tenures) {
//              _.each(tenures, function(tenure) {
//                div.innerHTML += '<p><span class="border-item" style="border-color:' + tenure.map_color + ';"></span> ' + tenure.name + '</p>';
//              });
//            });
            return div;
          };
          // Store interactive layer configuration object
          scope.interactiveLayers.lands = {
            tile: landsLayer,
            legend: landsLegend,
            active: true
          };
          landsLayer.name = 'lands';
          map.addLayer(landsLayer);
          landsLayer.addTo(map);

          /*
           * Init archaeological sites layer
           */
        var sites_promisse = $http.get('/api/arch_geojson/').then(function (response){
            var sites_geojson = response.data;
            var sitesPointsLayer = L.geoJSON(sites_geojson, {
                onEachFeature: function (feature, layer) {
                    layer.on('click', function(ev) {
                      markerClick(ev, 'site');
                    });
                },
                pointToLayer: function (feature, latlng) {
                    var marker = L.circleMarker(latlng, {
                        radius: 4,
                        fillColor: "#5CA2D1",
                        color: "#5CA2D1",
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.8,
                        pane: 'markers',
                    });
                    return marker
                },
                pane: 'markers',
            });
            var sitesLayer = L.markerClusterGroup({
                maxClusterRadius: 20,
                iconCreateFunction: function (cluster) {
                    var childCount = cluster.getChildCount();
                    var radius;
                    var class_sufix;
                    // If the ranges below changes, then village-marker-cluster-[big/md/sm]
                    // css class in _map.scss must change too
                    if (childCount >= 50) {
                        radius = 32;
                        class_sufix = 'big';
                    } else if (15 < childCount < 30) {
                        radius = 20;
                        class_sufix = 'md';
                    } else {
                        radius = 10;
                        class_sufix = 'sm';
                    }
                    return L.divIcon({html: '<div><span>' + childCount + '</span></div>',
                                      className: 'site-marker-cluster-' + class_sufix,
                                      iconSize: L.point(radius, radius)});
                },
            });
            sitesLayer.addLayer(sitesPointsLayer);
            var sitesLegend = L.control({'position': 'bottomright'});
            sitesLegend.onAdd = function(map) {
              var div = L.DomUtil.create('div', 'info legend sites');
              div.innerHTML += '<p><span class="point-item" style="background-color: #5CA2D1;"></span> <strong>Sítios arqueológicos</strong></p>';
              return div;
            };
            // Store interactive layer configuration object
            scope.interactiveLayers.sites = {
              tile: sitesLayer,
              legend: sitesLegend,
              active: true
            };
            sitesLayer.name = 'sites';

            // Add Layer to map
            map.addLayer(sitesLayer);
        });

           /*
           * Init villages layer
           */
            var villages_promisse = $http.get('/api/villages_geojson/').then(function (response){
                var villages_geojson = response.data;
                var villagesLayerMarkers = L.geoJSON(villages_geojson, {
                    onEachFeature: function (feature, layer) {
                        layer.on('click', function(ev) {
                          markerClick(ev, 'village');
                        });
                    },
                    pointToLayer: function (feature, latlng) {
                        // presence factor is 0, if no presence, or 1, if there is presence
                        var factor = 0;
                        if (feature.properties.guarani_presence.presence)
                            factor = 1;
                        var marker = L.circleMarker(latlng, {
                            radius: 4,
                            fillColor: "#e7ec13",
                            color: "#e7ec13",
                            weight: 2,
                            opacity: 0.8 * (1 - factor),
                            fillOpacity: 0.8 * factor,
                            pane: 'markers',
                        });
                        return marker
                    },
                    pane: 'markers',
                });
                // var villagesLayer = L.vectorGrid.slicer(villages_geojson);
                // map.addLayer(villagesLayer);
                var villagesLayer = L.markerClusterGroup({
                    maxClusterRadius: 20,
                    iconCreateFunction: function (cluster) {
                        var childCount = cluster.getChildCount();
                        var radius;
                        var class_sufix;
                        // If the ranges below changes, then village-marker-cluster-[big/md/sm]
                        // css class in _map.scss must change too
                        if (childCount >= 50) {
                            radius = 32;
                            class_sufix = 'big';
                        } else if (15 < childCount < 30) {
                            radius = 20;
                            class_sufix = 'md';
                        } else {
                            radius = 10;
                            class_sufix = 'sm';
                        }
                        return L.divIcon({html: '<div><span>' + childCount + '</span></div>',
                                          className: 'village-marker-cluster-' + class_sufix,
                                          iconSize: L.point(radius, radius)});
                    },
                    pane: 'markers',
                });
                villagesLayer.addLayer(villagesLayerMarkers);

                var villagesLegend = L.control({'position': 'bottomright'});
                villagesLegend.onAdd = function(map) {
                  var div = L.DomUtil.create('div', 'info legend villages');
                  div.innerHTML += '<p><strong>Aldeias Indígenas</strong></p>' +
                  '<p><span class="point-item legend2"></span> antigas áreas de uso ou áreas esbulhadas</p>' +
                  '<p><span class="point-item legend1"></span> habitadas atualmente</p>';
                  return div;
                };
                // Store interactive layer configuration object
                scope.interactiveLayers.villages = {
                  tile: villagesLayer,
                  legend: villagesLegend,
                  active: true
                };
                villagesLayer.name = 'villages';

                // Add Layer to map
                map.addLayer(villagesLayer);

                var show_label_zoom = 11; // zoom level threshold for showing/hiding labels
                var labels_visible = false;

                map.on('zoomend', function (e) {
                    var cur_zoom = map.getZoom();
                    if (labels_visible && cur_zoom < show_label_zoom) {
                        labels_visible = false;
                        villagesLayerMarkers.eachLayer(function (layer) {
                            // Show label
                            layer.unbindTooltip();
                        });
                    } else if(!labels_visible && cur_zoom >= show_label_zoom) {
                        labels_visible = true;
                        villagesLayerMarkers.eachLayer(function (layer) {
                            // Show label
                            layer.bindTooltip(layer.feature.properties.name, {
                                permanent: true,
                                direction: 'bottom',
                                opacity: 0.7,
                            });
                        });
                    }
                });
            });

          // Watch layer toggle to hide/display layer on leaflet
          $rootScope.$on('mapaguarani.toggleLayer', function(ev, layer) {
              if(scope.interactiveLayers[layer]) {
                if(scope.interactiveLayers[layer].active) {
                  scope.interactiveLayers[layer].active = false;
                  map.removeLayer(scope.interactiveLayers[layer].tile);
                } else {
                  scope.interactiveLayers[layer].active = true;
                  map.addLayer(scope.interactiveLayers[layer].tile);
                }
              }
          });

          // Control legend map display according to device display Width ($window.innerWidth)
          if ($window.innerWidth < 800) {
              scope.display_legends = false;
              $rootScope.menuIsClosed = true;
              map.removeControl(scope.interactiveLayers.lands.legend);
          } else {
              scope.display_legends = true;
          }

          villages_promisse.then(function (){
              if (!scope.display_legends)
                map.removeControl(scope.interactiveLayers.villages.legend);
          })

          sites_promisse.then(function (){
              if (!scope.display_legends)
                map.removeControl(scope.interactiveLayers.sites.legend);
          })

          angular.element($window).bind('resize', function () {
            if (!scope.display_legends && $window.innerWidth >= 800) {
                scope.display_legends = true;
                map.addControl(scope.interactiveLayers.villages.legend);
                map.addControl(scope.interactiveLayers.sites.legend);
                map.addControl(scope.interactiveLayers.lands.legend);
            } else if (scope.display_legends && $window.innerWidth < 800) {
                scope.display_legends = false;
                map.removeControl(scope.interactiveLayers.villages.legend);
                map.removeControl(scope.interactiveLayers.sites.legend);
                map.removeControl(scope.interactiveLayers.lands.legend);
            }
          });
        }
      }
    }
  ])

})(angular, L, _);
