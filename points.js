/* ------------------------------------------------------------------
   cammap - the points on the published map

   This file IS the map. Whatever is listed here is what every visitor
   sees, and it is the only way a point gets onto the site.

   Two ways to change it:

     By hand - copy one of the blocks below, change the four values,
               and save.

     By map  - open map.html?edit in your browser, place points with
               the form, the search box or by clicking the map, then
               press "Copy points.js" and paste the result over
               everything in this file.

   Either way the change is only public once you commit and push it.

   Every point needs a name, a latitude and a longitude. The note is
   optional - leave it as "" if there is nothing to say. Coordinates
   must fall inside Greater London.
   ------------------------------------------------------------------ */

var POINTS = [

  {
    name: "Dennis Severs' House",
    note: "A silent, candlelit walk through ten rooms. Book ahead.",
    lat: 51.521500,
    lon: -0.076400
  },

  {
    name: "Postman's Park",
    note: "The Watts Memorial: hand-painted tiles to ordinary people who died saving someone else.",
    lat: 51.516900,
    lon: -0.097700
  },

  {
    name: "St Dunstan in the East",
    note: "Bombed in 1941, left as a ruin and planted. Quiet at lunchtime, rarely busy.",
    lat: 51.510600,
    lon: -0.082100
  },

  {
    name: "Daunt Books, Marylebone",
    note: "Edwardian gallery at the back, travel writing shelved by country.",
    lat: 51.519500,
    lon: -0.151800
  }

];
