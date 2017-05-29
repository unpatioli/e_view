var mymap = L.map('map', {
  'center': [55.74, 37.6],
  'zoom': 11,
  'layers': [
    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    })
  ]
});

var projSrc = "+title= Московская СК (МГГТ)    +proj=tmerc +lat_0=55.66666666667 +lon_0=37.5 +k=1 +x_0=16.098 +y_0=14.512 +ellps=bessel +towgs84=316.151,78.924,589.650,-1.57273,2.69209,2.34693,8.4507 +units=m +no_defs";
// var projDst = "EPSG:4326";
var projDst = "WGS84";

var points,
    minmax,
    m_titles,
    m_id,
    m_min, m_max,
    v_min, v_max,
    continuous_colors = true;

var saved_state = {};

var voronoi = d3.voronoi()
  .x(function(p) { return p.x; })
  .y(function(p) { return p.y; });


var setColor = function() {
  var m_val = d3.select(this).attr(m_id);

  var k = 0;
  if (m_val <= v_min) {
    k = 0;
  } else if (m_val >= v_max) {
    k = 1;
  } else {
    k = (m_val - v_min) / (v_max - v_min);
  }
  var range = 130;
  k = Math.floor(range - range*k);
  if (!continuous_colors) {
    var steps_count = 2;
    var step = Math.floor(range / steps_count);
    k = step * Math.ceil(k / step);
  }
  if (k > range) {
    k = range;
  }

  var color = "hsl(" + k + ", 100%, 50%)";

  return color;
}

var draw = function() {
  d3.select('#overlay').remove();

  var bounds = mymap.getBounds(),
    topLeft = mymap.latLngToLayerPoint(bounds.getNorthWest()),
    bottomRight = mymap.latLngToLayerPoint(bounds.getSouthEast()),
    existing = d3.set(),
    drawLimit = bounds.pad(0.4),
    zoom = mymap.getZoom();


  var filteredPoints = points.filter(function(p) {
    var ll = proj4(projSrc, projDst, [p.geometry.coordinates[0]*1000, p.geometry.coordinates[1]*1000]);
    var latlng = new L.LatLng(ll[1], ll[0]);
    if (!drawLimit.contains(latlng)) {
      return false;
    }
    var point = mymap.latLngToLayerPoint(latlng);

    key = point.toString();
    if (existing.has(key)) { return false };
    existing.add(key);

    p.x = point.x;
    p.y = point.y;
    p.color = 'f00';
    p.data = { sample: 1 };

    return true;
  });

  var svg = d3.select(mymap.getPanes().overlayPane).append("svg")
    .attr('id', 'overlay')
    .attr('class', 'leaflet-zoom-hide')
    .style('width', mymap.getSize().x + 'px')
    .style('height', mymap.getSize().y + 'px')
    .style('margin-left', topLeft.x + 'px')
    .style('margin-top', topLeft.y + 'px');

  var g = svg.append("g")
    .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

  // var svgPoints = g.attr("class", "points")
  // .selectAll("g")
  // .data(filteredPoints)
  // .enter().append("g")
  // .attr("class", "point");

  var polygon = svg.append("g")
      .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")")
      .attr("class", "polygons")
    .selectAll("path")
    .data(voronoi(filteredPoints).polygons())
    .enter().append("path")
    .attr("d",
      function(d) {
        var fd = d.filter(
          function(el) {
            return (el && el.length != 0);
          });
        return "M" + fd.join("L") + "Z";
      }
    )

    .each(function(d) {
      var header = d3.select(this);
      d3.keys(d.data.properties).forEach(function(key) {
        header.attr(key, d.data.properties[key]);
      });
    })

    .style("stroke-width", "0")
    .style("fill", setColor)
    .style("opacity", "0.5")
    .style("pointer-events", "all")
    // .on("click", selectPoint)
  ;

  // svgPoints.append("path")
  // .attr("d", function(d) { console.log(d); return d.cell ? "M" + d.cell.join("L") + "Z" : null; })
  // .style("fill", "#f00")
  // .style("pointer-events", "all")
  // .on("click", selectPoint)
  // ;

  // svgPoints.append("circle")
  // .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
  // .style('fill', function(d) { return '#' + d.color } )
  // .attr("r", 2);
};

var mapLayer = L.Layer.extend({
  onAdd: function(map) {
    this._map = map;
    map.on('viewreset moveend', draw, this);
    draw();
  },

  onRemove: function(map) {
    map.off('viewreset moveend', draw, this);
  },
});

var set_range_val = function() {
  $("#range").val(v_min + " - " + v_max);
};

var set_slider_val = function() {
  var slider = $("#slider-range");
  slider.slider("option", "min", m_min);
  slider.slider("option", "max", m_max);
  if (m_id in saved_state) {
    [v_min, v_max] = saved_state[m_id];
  } else {
    [v_min, v_max] = minmax[m_id];
  }
  slider.slider("option", "values", [v_min, v_max]);
  set_range_val();
};

var set_saved_val = function() {
  var saved_txt = $("#saved");
  if (m_id in saved_state) {
    saved_txt.text(saved_state[m_id]);
  } else {
    saved_txt.text("Unsaved");
  }
};

var set_id = function(id) {
  m_id = id;
  [m_min, m_max] = minmax[m_id];

  set_slider_val();
  set_saved_val();
};

$(function() {
  mymap.whenReady(function() {
    d3.json('out.json', function(zones) {
      points = zones.features;
      minmax = zones.minmax;

      // populate zone selector
      m_titles = zones.m_titles;
      $.each(m_titles, function(val, text) {
        $("#matrix_selector").append($("<option />").val(val).text(text));
      });
      set_id($("#matrix_selector").val());

      mymap.addLayer(new mapLayer());
    });
  });

  [v_max, v_min] = (m_id in saved_state) ? saved_state[m_id] : [m_min, m_max];
  $("#slider-range").slider({
    range: true,
    min: m_min,
    max: m_max,
    values: [v_max, v_min],
    slide: $.throttle(300, function(evt, ui) {
        v_min = ui.values[0];
        v_max = ui.values[1];
        saved_state[m_id] = [v_min, v_max];
        set_range_val();
        draw();
      })
  });

  $("#matrix_selector").change(function() {
    set_id($(this).val());

    draw();
  });

  $("#btn_save").click(function() {
    saved_state[m_id] = [v_min, v_max];
    set_saved_val();
  });

  $("#continuous_colors").change(function() {
    continuous_colors = $(this).prop("checked");
    draw();
  });
});


// $("#matrix_min").change(function() {
//   m_min = parseFloat($(this).val());
//   draw();
// });
// $("#matrix_max").change(function() {
//   m_max = parseFloat($(this).val());
//   draw();
// });

// $.getJSON('out.json', {}, function(geo_data) {
//   // Get climate info
//   L.geoJSON(geo_data, {
//     style: function(feature) {
//       return {
//         weight: 20,
//         // color: "hsl(10, 100%, 50%)"
//       };
//     },
// 
//     coordsToLatLng: function(coords) {
//       var x = coords[0] * 1000;
//       var y = coords[1] * 1000;
//       var ll = proj4(projSrc, projDst, [x, y]);
//       return new L.LatLng(ll[1], ll[0], true);
//     },
// 
//     // onEachFeature: function(feature, layer) {
//     //   // Add popups to the map
//     //   if (feature.properties && feature.properties.NAME) {
//     //     var v = _.find(clim, function(item) { return item.name === feature.properties.ADM3_NAME; });
//     //     layer.bindPopup("<p>" + feature.properties.NAME + "</p>" +
//     //                     "<p>Средняя температура января: " + v.jan + "</p>");
//     //   }
//     // },
// 
//     pointToLayer: function(feature, latlng) {
//       return L.circleMarker(latlng, {
//         radius: 1,
//         fillColor: "#ff7800",
//         color: "#ff7800",
//         weight: 1,
//         opacity: 1,
//         fillOpacity: 0.8
//       });
//     },
// 
//   }).addTo(mymap);
// });
