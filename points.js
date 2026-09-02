/* ------------------------------------------------------------------
   cammap - facial recognition in London

   Every entry comes from a published source: the Met's own LFR
   deployment records (2020-2025), the British Transport Police
   deployment register (2026), and named press reporting for the
   shops. Nothing here is estimated. Where a source gave only a
   borough, the note says the pin is approximate.

   Read the notes before reading the map. Most Met entries are VAN
   deployments - a camera that stood there on given dates, not one
   that is there now. The only permanent police cameras in this list
   are the two Croydon sites.
   ------------------------------------------------------------------ */

var POINTS = [

  {
    name: "Acton",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.508140,
    lon: -0.273261
  },

  {
    name: "Barking",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.540268,
    lon: 0.079324
  },

  {
    name: "Barnet",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.653090,
    lon: -0.200226
  },

  {
    name: "Belvedere Road, Waterloo",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.505018,
    lon: -0.116314
  },

  {
    name: "Bethnal Green",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.530346,
    lon: -0.056163
  },

  {
    name: "Bethnal Green Road",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.526447,
    lon: -0.064883
  },

  {
    name: "Bexleyheath",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.456460,
    lon: 0.146094
  },

  {
    name: "Bond Street Station",
    note: "Met Police LFR van - 4 deployments 2025",
    lat: 51.514256,
    lon: -0.149786
  },

  {
    name: "Brent",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.563996,
    lon: -0.275906
  },

  {
    name: "Brigstock Road, Thornton",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.395055,
    lon: -0.109973
  },

  {
    name: "Brixton Road",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.470254,
    lon: -0.112507
  },

  {
    name: "Brixton Road, Brixton",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.467895,
    lon: -0.112637
  },

  {
    name: "Broadway, Stratford",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.541736,
    lon: 0.003557
  },

  {
    name: "Bromley",
    note: "Met Police LFR van - 2 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.402805,
    lon: 0.014814
  },

  {
    name: "Bruce Grove, Tottenham",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.593711,
    lon: -0.070005
  },

  {
    name: "Camberwell Green",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.474907,
    lon: -0.092601
  },

  {
    name: "Camden",
    note: "Met Police LFR van - 4 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.542797,
    lon: -0.162480
  },

  {
    name: "Camden High Road",
    note: "Met Police LFR van - 2 deployments 2023-2025",
    lat: 51.534932,
    lon: -0.138995
  },

  {
    name: "Catford",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.445321,
    lon: -0.019753
  },

  {
    name: "Church Street, Croydon",
    note: "Met Police LFR van - 6 deployments 2023-24",
    lat: 51.373648,
    lon: -0.104180
  },

  {
    name: "Clapham Common",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.461801,
    lon: -0.138304
  },

  {
    name: "Clapham Junction",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.464459,
    lon: -0.170518
  },

  {
    name: "Clarence Street, Kingston",
    note: "Met Police LFR van - 4 deployments 2025",
    lat: 51.411443,
    lon: -0.300439
  },

  {
    name: "Covent Garden",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.512873,
    lon: -0.122564
  },

  {
    name: "Coventry Street, Piccadilly",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.510040,
    lon: -0.133936
  },

  {
    name: "Crisp Street, Poplar",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.514677,
    lon: -0.014725
  },

  {
    name: "Croydon",
    note: "Met Police LFR van - 5 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.371305,
    lon: -0.101957
  },

  {
    name: "Dagenham",
    note: "Met Police LFR van - 3 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.541327,
    lon: 0.148114
  },

  {
    name: "Dagenham Heathway",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.541553,
    lon: 0.145638
  },

  {
    name: "Dalston",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.543212,
    lon: -0.076013
  },

  {
    name: "Dalston Junction",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.545284,
    lon: -0.074968
  },

  {
    name: "Dalston Kingsland",
    note: "Met Police LFR van - 4 deployments 2025",
    lat: 51.548191,
    lon: -0.076053
  },

  {
    name: "Deptford High Street",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.476412,
    lon: -0.025856
  },

  {
    name: "Ealing Broadway",
    note: "Met Police LFR van - 5 deployments 2023-2025",
    lat: 51.514980,
    lon: -0.300407
  },

  {
    name: "Ealing Broadway Station",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.515184,
    lon: -0.302214
  },

  {
    name: "Earls Court",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.488797,
    lon: -0.198220
  },

  {
    name: "Earls Court Road, Earls Court",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.494788,
    lon: -0.194750
  },

  {
    name: "East Ham",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.539400,
    lon: 0.052604
  },

  {
    name: "East Ham, High Road",
    note: "Met Police LFR van - 6 deployments 2025",
    lat: 51.546269,
    lon: 0.048904
  },

  {
    name: "Edgware Road",
    note: "Met Police LFR van - 4 deployments 2023-2025",
    lat: 51.520193,
    lon: -0.166764
  },

  {
    name: "Edmonton Green",
    note: "Met Police LFR van - 3 deployments 2025",
    lat: 51.624500,
    lon: -0.061402
  },

  {
    name: "Enfield",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.652085,
    lon: -0.081018
  },

  {
    name: "Euston station",
    note: "British Transport Police LFR - 4 deployments in the 2026 station trial",
    lat: 51.528853,
    lon: -0.134191
  },

  {
    name: "Finsbury Park",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.564835,
    lon: -0.106414
  },

  {
    name: "George Street, Croydon",
    note: "Met Police LFR van - 8 deployments 2023-2025",
    lat: 51.373900,
    lon: -0.098912
  },

  {
    name: "Green Street, Newham",
    note: "Met Police LFR van - 5 deployments 2025",
    lat: 51.546903,
    lon: 0.031186
  },

  {
    name: "Green Street, Upton Park",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.546553,
    lon: 0.031288
  },

  {
    name: "Hackney",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.543240,
    lon: -0.049362
  },

  {
    name: "Hammersmith",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.492038,
    lon: -0.223640
  },

  {
    name: "Hammersmith Broadway",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.493174,
    lon: -0.223804
  },

  {
    name: "Haringey",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.587936,
    lon: -0.105438
  },

  {
    name: "Harlesden",
    note: "Met Police LFR van - 2 deployments 2023-2025",
    lat: 51.536357,
    lon: -0.257833
  },

  {
    name: "Hatton Garden",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.520049,
    lon: -0.108371
  },

  {
    name: "Heathway, Dagenham",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.536390,
    lon: 0.148201
  },

  {
    name: "High Road, Haringey",
    note: "Met Police LFR van - 3 deployments 2023-24",
    lat: 51.591166,
    lon: -0.104195
  },

  {
    name: "High Street, Bexleyheath",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.440647,
    lon: 0.153083
  },

  {
    name: "High Street, Bromley",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.404694,
    lon: 0.015094
  },

  {
    name: "High Street, East Ham",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.539642,
    lon: -0.000115
  },

  {
    name: "High Street, Harlesden",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.535102,
    lon: -0.243402
  },

  {
    name: "High Street, Hounslow",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.470414,
    lon: -0.355498
  },

  {
    name: "High Street, Ilford",
    note: "Met Police LFR van - 6 deployments 2023-2025",
    lat: 51.580967,
    lon: 0.021934
  },

  {
    name: "High Street, Lewisham",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.478673,
    lon: -0.026051
  },

  {
    name: "High Street, Sutton",
    note: "Met Police LFR van - 4 deployments 2023-2025",
    lat: 51.365440,
    lon: -0.194008
  },

  {
    name: "High Street, Uxbridge",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.546175,
    lon: -0.479465
  },

  {
    name: "Holloway Road",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.552867,
    lon: -0.113009
  },

  {
    name: "Hounslow",
    note: "Met Police LFR van - 4 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.468613,
    lon: -0.361347
  },

  {
    name: "Hounslow High Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.469580,
    lon: -0.357680
  },

  {
    name: "Ilford",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.558273,
    lon: 0.071167
  },

  {
    name: "Ilford High Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.569645,
    lon: 0.125724
  },

  {
    name: "Islington",
    note: "Met Police LFR van - 2 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.538429,
    lon: -0.099905
  },

  {
    name: "Kilburn High Road",
    note: "Met Police LFR van - 5 deployments 2025",
    lat: 51.537748,
    lon: -0.191353
  },

  {
    name: "Kilburn Lane",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.528842,
    lon: -0.216062
  },

  {
    name: "King Street, Hammersmith",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.492733,
    lon: -0.227664
  },

  {
    name: "King's Cross Central",
    note: "Private facial recognition by the site's developer 2016-2018, withdrawn 2019 after an ICO inquiry",
    lat: 51.535238,
    lon: -0.125401
  },

  {
    name: "King's Cross St Pancras",
    note: "British Transport Police LFR - 1 deployment in the 2026 station trial",
    lat: 51.530609,
    lon: -0.123949
  },

  {
    name: "King's Cross station",
    note: "British Transport Police LFR - 4 deployments in the 2026 station trial",
    lat: 51.530491,
    lon: -0.121655
  },

  {
    name: "Kings Cross",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.532395,
    lon: -0.123022
  },

  {
    name: "Kings Street, Hammersmith",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.470192,
    lon: -0.210372
  },

  {
    name: "Kingsland High Street",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.550198,
    lon: -0.075160
  },

  {
    name: "Kingston",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.412933,
    lon: -0.301820
  },

  {
    name: "Knightsbridge",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.500844,
    lon: -0.166965
  },

  {
    name: "Leicester",
    note: "Met Police LFR van - 1 deployment 2020-22",
    lat: 51.510777,
    lon: -0.130275
  },

  {
    name: "Leicester Square",
    note: "Met Police LFR van - 4 deployments 2025",
    lat: 51.509961,
    lon: -0.130394
  },

  {
    name: "Lewisham",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.462429,
    lon: -0.010179
  },

  {
    name: "Lewisham High Street",
    note: "Met Police LFR van - 3 deployments 2025",
    lat: 51.462867,
    lon: -0.010360
  },

  {
    name: "Leyton",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.569673,
    lon: -0.015681
  },

  {
    name: "Liverpool Street station",
    note: "British Transport Police LFR - 2 deployments in the 2026 station trial",
    lat: 51.517264,
    lon: -0.080571
  },

  {
    name: "London Bridge",
    note: "Met Police LFR van - 3 deployments 2023-24",
    lat: 51.508049,
    lon: -0.087671
  },

  {
    name: "London Bridge station",
    note: "British Transport Police LFR - 1 deployment in the 2026 station trial",
    lat: 51.504876,
    lon: -0.085147
  },

  {
    name: "London Road, Croydon",
    note: "Met Police - FIXED LFR cameras on street furniture, installed from Oct 2025 | Met Police LFR van - 2 deployments 2023-2025",
    lat: 51.387128,
    lon: -0.111014
  },

  {
    name: "London Road, Morden",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.395254,
    lon: -0.172116
  },

  {
    name: "Love Lane, Haringey",
    note: "Met Police LFR van - 2 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.604552,
    lon: -0.070489
  },

  {
    name: "Marble Arch",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.513184,
    lon: -0.158905
  },

  {
    name: "Mare Street, Hackney",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.541551,
    lon: -0.055248
  },

  {
    name: "North End Croydon",
    note: "Met Police LFR van - 7 deployments 2025",
    lat: 51.375660,
    lon: -0.101318
  },

  {
    name: "North End, Croydon",
    note: "Met Police - FIXED LFR cameras on street furniture, installed from Oct 2025 | Met Police LFR van - 21 deployments 2023-2025",
    lat: 51.377881,
    lon: -0.102542
  },

  {
    name: "Northumberland Park",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.601908,
    lon: -0.053865
  },

  {
    name: "O2 Arena",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.502937,
    lon: 0.003203
  },

  {
    name: "Oxford Circus",
    note: "Met Police LFR van - 16 deployments 2020-2025",
    lat: 51.515361,
    lon: -0.140779
  },

  {
    name: "Oxford Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.515984,
    lon: -0.135174
  },

  {
    name: "Paddington Station",
    note: "Met Police LFR van - 3 deployments 2025",
    lat: 51.515714,
    lon: -0.176603
  },

  {
    name: "Palace Exchange",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.651453,
    lon: -0.082013
  },

  {
    name: "Peckham",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.473412,
    lon: -0.069932
  },

  {
    name: "Peckham Rye",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.470006,
    lon: -0.069413
  },

  {
    name: "Piccadilly Circus",
    note: "Met Police LFR van - 3 deployments 2020-2025",
    lat: 51.510138,
    lon: -0.133936
  },

  {
    name: "Piccadilly, Hard Rock",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.504078,
    lon: -0.148443
  },

  {
    name: "Poplar - Vesey Path",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.512129,
    lon: -0.014437
  },

  {
    name: "Powis Street",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.492588,
    lon: 0.062603
  },

  {
    name: "Powis Street, Woolwich",
    note: "Met Police LFR van - 9 deployments 2023-2025",
    lat: 51.492083,
    lon: 0.064301
  },

  {
    name: "Praed Street, Paddington",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.515479,
    lon: -0.175365
  },

  {
    name: "Richmond",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.440553,
    lon: -0.307639
  },

  {
    name: "Richmond High Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.469623,
    lon: -0.263326
  },

  {
    name: "Romford",
    note: "Met Police LFR van - 5 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.576046,
    lon: 0.182265
  },

  {
    name: "Rushey Green",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.447530,
    lon: -0.018176
  },

  {
    name: "Rye Lane, Peckham",
    note: "Met Police LFR van - 5 deployments 2025",
    lat: 51.467074,
    lon: -0.065766
  },

  {
    name: "Sainsbury's Camden Town",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.540516,
    lon: -0.140764
  },

  {
    name: "Sainsbury's Dalston",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.547484,
    lon: -0.073206
  },

  {
    name: "Sainsbury's East Dulwich",
    note: "Sainsbury's - Facewatch store facial recognition, paused after a wrongful ejection",
    lat: 51.461793,
    lon: -0.084998
  },

  {
    name: "Sainsbury's Elephant and Castle",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.494570,
    lon: -0.097640
  },

  {
    name: "Sainsbury's Ladbroke Grove",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.526296,
    lon: -0.217664
  },

  {
    name: "Sainsbury's Sydenham",
    note: "Sainsbury's - Facewatch store facial recognition, trial store from Sep 2025",
    lat: 51.430199,
    lon: -0.033317
  },

  {
    name: "Sainsbury's Whitechapel",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.521013,
    lon: -0.058468
  },

  {
    name: "Selhurst Park, Holmesdale Road",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.398828,
    lon: -0.081188
  },

  {
    name: "Selhurst Park, Norwood Junction",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.397090,
    lon: -0.074260
  },

  {
    name: "Seven Sisters High Road",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.583201,
    lon: -0.072471
  },

  {
    name: "Seven Sisters Road",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.562813,
    lon: -0.108782
  },

  {
    name: "Shepherds Bush",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.504054,
    lon: -0.224769
  },

  {
    name: "Shepherds Bush Green",
    note: "Met Police LFR van - 3 deployments 2025",
    lat: 51.504247,
    lon: -0.221755
  },

  {
    name: "Shoreditch High Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.523253,
    lon: -0.074467
  },

  {
    name: "South Bank",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.506532,
    lon: -0.113420
  },

  {
    name: "South Street, Romford",
    note: "Met Police LFR van - 6 deployments 2023-2025",
    lat: 51.572017,
    lon: 0.183993
  },

  {
    name: "Southall",
    note: "Met Police LFR van - 2 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.511146,
    lon: -0.375517
  },

  {
    name: "Southwark",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.505653,
    lon: -0.099565
  },

  {
    name: "St Ann's, Harrow",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.581937,
    lon: -0.333388
  },

  {
    name: "St John's Hill, Clapham",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.463701,
    lon: -0.167961
  },

  {
    name: "St Pancras International",
    note: "British Transport Police LFR - 1 deployment in the 2026 station trial",
    lat: 51.532720,
    lon: -0.127003
  },

  {
    name: "Station Lane, Hornchurch",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.561243,
    lon: 0.221379
  },

  {
    name: "Station Parade",
    note: "Met Police LFR van - 4 deployments 2025 (the record says only \"Station Parade\", and London has several - this pin is a guess)",
    lat: 51.548937,
    lon: 0.199284
  },

  {
    name: "Station Parade, Barking",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.538624,
    lon: 0.080492
  },

  {
    name: "Station Road, Hayes",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.502715,
    lon: -0.421300
  },

  {
    name: "Stratford",
    note: "Met Police LFR van - 2 deployments 2020-24",
    lat: 51.541289,
    lon: -0.003547
  },

  {
    name: "Stratford Broadway",
    note: "Met Police LFR van - 7 deployments 2025",
    lat: 51.541374,
    lon: 0.002803
  },

  {
    name: "Stratford station",
    note: "British Transport Police LFR - 1 deployment in the 2026 station trial",
    lat: 51.541251,
    lon: -0.002268
  },

  {
    name: "Stratford Westfield",
    note: "Met Police LFR van - 6 deployments 2023-2025",
    lat: 51.543064,
    lon: -0.006417
  },

  {
    name: "Streatham High Road",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.417335,
    lon: -0.126424
  },

  {
    name: "T2 Heathrow Airport",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.469273,
    lon: -0.451799
  },

  {
    name: "Thornton Heath",
    note: "Met Police LFR van - 2 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.399110,
    lon: -0.098606
  },

  {
    name: "Tooting",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.427821,
    lon: -0.167967
  },

  {
    name: "Tooting Broadway",
    note: "Met Police LFR van - 9 deployments 2023-2025",
    lat: 51.427739,
    lon: -0.168291
  },

  {
    name: "Tottenham Court Road",
    note: "Met Police LFR van - 5 deployments 2023-2025",
    lat: 51.516134,
    lon: -0.132800
  },

  {
    name: "Tottenham Hale",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.588123,
    lon: -0.059944
  },

  {
    name: "Town Square, Walthamstow",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.583780,
    lon: -0.021346
  },

  {
    name: "Upton Park",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.535106,
    lon: 0.033984
  },

  {
    name: "Uxbridge",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.544951,
    lon: -0.481667
  },

  {
    name: "Uxbridge Road, Shepherds",
    note: "Met Police LFR van - 2 deployments 2023-2025",
    lat: 51.506491,
    lon: -0.239410
  },

  {
    name: "Victoria station",
    note: "British Transport Police LFR - 5 deployments in the 2026 station trial",
    lat: 51.495052,
    lon: -0.144845
  },

  {
    name: "Victoria Street",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.497980,
    lon: -0.133591
  },

  {
    name: "Walthamstow",
    note: "Met Police LFR van - 3 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.584470,
    lon: -0.018819
  },

  {
    name: "Walthamstow Central",
    note: "Met Police LFR van - 6 deployments 2025",
    lat: 51.582893,
    lon: -0.019994
  },

  {
    name: "Walthamstow Market",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.582208,
    lon: -0.030573
  },

  {
    name: "Walworth Road",
    note: "Met Police LFR van - 6 deployments 2023-2025",
    lat: 51.489848,
    lon: -0.096681
  },

  {
    name: "Walworth Road, Southwark",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.490318,
    lon: -0.096975
  },

  {
    name: "Wardour Street, Westminster",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.510697,
    lon: -0.131629
  },

  {
    name: "Waterloo station",
    note: "British Transport Police LFR - 3 deployments in the 2026 station trial",
    lat: 51.502678,
    lon: -0.112062
  },

  {
    name: "Wealdstone High Street",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.594309,
    lon: -0.335252
  },

  {
    name: "Wembley",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.556069,
    lon: -0.279603
  },

  {
    name: "Wembley Central",
    note: "Met Police LFR van - 6 deployments 2025",
    lat: 51.552328,
    lon: -0.296675
  },

  {
    name: "West Croydon",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.378808,
    lon: -0.102039
  },

  {
    name: "Westfield, Shepherds",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.507848,
    lon: -0.221808
  },

  {
    name: "Westminster",
    note: "Met Police LFR van - 22 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.500444,
    lon: -0.126540
  },

  {
    name: "Westminster Bridge Street",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.501356,
    lon: -0.124930
  },

  {
    name: "Westminster, Birdcage Walk",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.500825,
    lon: -0.134782
  },

  {
    name: "Westminster, Piccadilly",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.509165,
    lon: -0.135700
  },

  {
    name: "Westminster, Savoy Place",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.509162,
    lon: -0.121026
  },

  {
    name: "Westminster, The Mall",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.506082,
    lon: -0.130261
  },

  {
    name: "Whitechapel",
    note: "Met Police LFR van - 3 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.517486,
    lon: -0.065968
  },

  {
    name: "Wimbledon Bridge",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.420942,
    lon: -0.206776
  },

  {
    name: "Wood Green",
    note: "Met Police LFR van - 3 deployments 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.597205,
    lon: -0.109959
  },

  {
    name: "Wood Green High Road",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.589876,
    lon: -0.105348
  },

  {
    name: "Woolwich",
    note: "Met Police LFR van - 8 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.482670,
    lon: 0.062334
  }

];
