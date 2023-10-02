# Installer
Hidden (system role) app install service
!! Heavy WIP, doesn't work yet

## Roadmap
- [ ] Localization (& localized install err msgs from KaiRoot)
- [ ] AIB Parsing

## Standards for Installation Packages

### Openwebapp Package (.wpk) // application/openwebapp+zip
Package format used by OmniSD with mozApps.mgmt.import, has the following structure:
1. application.zip - Containing: Application Files (HTML, CSS, JS, etc.) & manifest.webapp  
2. metadata.json - Containing information about version, which is suggested to keep at one and the URL to the app's origin and manifest (app://yourapp/manifest.webapp), here's what it looks like: {"version": 1,"manifestURL":"app://files.gerda.tech/manifest.webapp"}  
3. update.webapp - Can be left empty but must be present  

### .webpkg // application/x-web-package
The zipped version of the WebIDE Folder format, the OpenWebApp's application.zip or the format submitted to KaiStore

### .aib // App Installation Bundle // application/x-install-bundle
Newer "universal" format inspired by KaiOS 3.0 bundles, that can easily be converted to other package types
It is always suggested to build an .aib file along with .mozPkg files when releasing your app.
Here's this format's structure:
1. application.zip > Application Insides (HTML, CSS, JS), without manifest.webapp
2. application.webmanifest > manifest.webapp

Installation procedure

1. AIB Installer unzips .aib file
2. AIB Installer checks webmanifest for regulations placed by WebIDE

-- CONVERSION TO OPENWEBAPP+ZIP --
3. AIB Installer creates a /tmp/aib-install/ folder
4. AIB Installer unzips application.zip, places webmanifest inside as manifest.webapp, 
   zips application back
5. AIB Installer proceeds to create a mozApps/OmniSD Package (metadata.json, etc.)
   from webmanifest data and application.zip
6. AIB Installer uses mozApps.mgmt.import to install OmniSD Package.

-- CONVERSION TO X-WEB-PACKAGE --
3. AIB Installer converts the package to the standard webapps folder applications found in /data/local/webapps
4. AIB Installer installs using Affe Null's self-debug

-- PATCH INSTALLATION (MUST REBOOT AFTER) --
3. AIB Installer creates a /tmp/aib-install/ folder
4. AIB Installer converts the package to the standard webapps folder applications found in /data/local/webapps
5. AIB Installer manually places application in webapps and patches webapps.json   
 