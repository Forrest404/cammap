# Notes and details about the project

## Project goals

- The goal of *cammap* is to create a website that:
    - Maps all LFR vans and fixed cameras across london - with locations all over the world planned after finishing the london version
    - It differentiates between different types of cameras - fixed cameras, van cameras, nonfunctional cameras, supermarket (facewatch) cameras, british transport map, and more - using different colours which are visible in the bottom right corner below the map - It does this by using an SQL database which has different identifiers - e.g. fixedcam, nonfunccam, facewatchcam, vancam, transportcam, etc, which makes things easier. The names must be unique as such to make the map scalable to different cities and countries.
    - It shows previous facial recognition cameras with a "legacy" toggle, and may have a feature that uses AI to predict/track the facial recognition vans
    - The map can be viewed as a normal street map or in a satellite, etc view.
    - It has an accounts feature where users sign up with a simple username and password - Accounts should be completely anonymous - a user makes an account under a username and has to assign a strong password (one capital letter, number and symbol...). IP addresses might be logged to prevent spam but hopefully not to maintain complete anonymity
    - The accounts feature distinguishes between moderators/admins and normal users. The normal user has access to a "report camera" button which allows them to report cameras and also report the status of cameras - e.g. if they are nonfunctional. They can upload images for proof and videos too, in a totally anonymous manner. They also have access to a leaderboard which displays the top users. Different camera categories have different ammounts of XP (experience points) gained. For example, a normal camera will gain 5xp whereas a nonfunctional or transport one will gain 50XP (as an example). New users gain more xp than established ones (perhaps) and there are daily/weekly EXP counts too.
    - Admins however have a different view. They can authorise cameras which have been reported to enable them to be seen on the map. Cameras are also added if 3 (or 5) or more users report them within the same fixed radius, to bypass moderation, in case the site becomes very popular.

    - The UI must be easy to use, lightweight, working on mobile, and polished.

## TODO

- Make it *active* facial recognition cameras, and add a legacy toggle to show ones previously in use. We could also perhaps use AI to predict where the next LFR deployments will be.
- Make the fixed LFR cameras (not vans) a different color to the vans
- Add satellite, etc views.
- Accounts should be completely anonymous - a user makes an account under a username and has to assign a strong password (one capital letter, number and symbol...). IP addresses might be logged to prevent spam but hopefully not to maintain complete anonymity

## Forrest404

- Leaderboard
- Superbase (server setup)
- Accounts functionality
etc

## Laki2128

- Fix and build UI
etc

https://www.instagram.com/reels/DatEAylKkdA/
https://www.jaredkrauss.art/a-london-history-of-facial-recognition-systems - the LFR map
jared_krauss

https://www.gov.uk/government/consultations/legal-framework-for-using-facial-recognition-in-law-enforcement/consultation-on-a-new-legal-framework-for-law-enforcement-use-of-biometrics-facial-recognition-and-similar-technologies-accessible
https://gdprcourse.co.uk/blog/cctv-and-surveillance-statistics-uk
https://www.met.police.uk/foi-ai/metropolitan-police/disclosure-2024/april-2024/locations-facial-recognition-cameras-arrests-london-boroughs-2021-2023/
https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf
https://www.btp.police.uk/news/btp/news/england/btp-expands-live-facial-recognition-lfr-trial-into-london-underground-stations/
https://tfl.gov.uk/info-for/media/press-releases/2026/august/british-transport-police-trialling-live-facial-recognition-at-transport-for-london-stations
https://www.bbc.co.uk/news/articles/c07r0gvgjxyo
https://bigbrotherwatch.org.uk/campaigns/stop-facial-recognition/
https://www.instagram.com/jared_krauss/reels/
https://surfshark.com/facial-recognition-map
https://www.btp.police.uk/police-forces/british-transport-police/areas/about-us/about-us/facial-recognition-technology/?ref=ed_direct
https://www.google.com/search?q=is+there+a+project+mapping+out+all+london+facial+recognition+camera&client=firefox-b-d&hs=96DB&sxsrf=APpeQnsGjz1cBU2pBPccTpziHPlJMXNubw%3A1788370446786&vsint=&aep=1&ntc=1&cs=1&dpr=1.33&atvm=2&mstk=AUtExfAKoTorR-OWR0S-9UlIn5PwCIawdaxqFnYGBmQ-neUkdTBABiLUCakauTopSQ_O33OAc5cDAL7kh_3IjwfrAoSV396qpc3cyqK2bfy4-026BPh2NBaq43aaiRQ1YCDsRtN7gloDvm8GKcPpPntE1jBG4NnpiZsSiDKyTDRkyf0_1KBIrUhAZI5JPskEaXiydnAMbNCk9-7j5nGcqeGjfISuHWVy1j8XIw2od1YFxaaRbO4oqq7FidClMQ&csuir=1&udm=50