/* ------------------------------------------------------------------
   cammap - the cameras on the published map

   This file IS the map. Whatever is listed here is what every visitor
   sees, and it is the only way a point gets onto the site.

   Two ways to change it:

     By hand - copy one of the blocks below, change the four values,
               and save.

     By map  - open index.html?edit in your browser, place cameras
               with the form, the search box or by clicking the map, then
               press "Copy points.js" and paste the result over
               everything in this file.

   Either way the change is only public once you commit and push it.

   Every camera needs a name, a latitude and a longitude. The note is
   optional - leave it as "" if there is nothing to say. Coordinates
   must fall inside Greater London.
   ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   cammap - the cameras on the published map

   Written out by index.html?edit. Paste this over everything in
   points.js, then commit and push to publish it.
   ------------------------------------------------------------------ */

var POINTS = [

  {
    name: "cam 1",
    note: "",
    lat: 51.477132,
    lon: -0.191669
  },

  {
    name: "cam 2",
    note: "",
    lat: 51.476714,
    lon: -0.203679
  }

];


