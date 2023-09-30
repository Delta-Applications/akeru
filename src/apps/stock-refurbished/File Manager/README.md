# File Manager
## This file manager is a "fork" of the gerda.tech file manager, there are a few things that change:
### Easier to implement MIME Types
- Mime Mapper chooses icons directly
- Mime Mapper determines file type directly
- Mime Mapper provides easy access to removing, adding, support for MIME Types



## Roadmap
- Add support for unzipping .zips, tar, etc.
- List more zip packages MIME Types
- Add in-house viewing support for PDF, Markdown, HTML, and other essential file types
- If Linux allows an easy implementation, open .JAR Archives.
- All archives that are openable (.jar, .aib, etc.) will receive their own special icon and call their own mozActivity, but will still be able to be extracted from the options menu
- View plain text
- Execute Bourne Shell Scripts (.sh) and give them an icon

## Standards for Installation Packages

### Webapp Package (.wpk) // application/openwebapp+zip
### .mozPkg / .omniPkg // mozApps.mgmt.import Package (OmniSD Package) // application/x-mozapp+zip
![mozPackage Banner](screenshots/mozPkg.png)

To install this type of package, a permission is required in manifest.webapp

```json
    "webapps-manage": {
      "description": "Support package installation"
    }
```
### What's inside a mozPackage?
1. application.zip - Containing: Application Files (HTML, CSS, JS, etc.) & manifest.webapp  
2. metadata.json - Containing information about version, which is suggested to keep at one and the URL to the app's origin and manifest (app://yourapp/manifest.webapp), here's what it looks like: {"version": 1,"manifestURL":"app://files.gerda.tech/manifest.webapp"}  
3. update.webapp - Can be left empty but must me present  

### What is a mozPackage?

- A mozPkg or omniPkg file is simply the zip file that OmniSD or other implementations of mozApps.mgmt.import use to install applications.
- It has been renamed to mozPackage because of the current association with zip files and to mantain a standard enviroment around releases.
- This way, the file manager, and other applications, can easily differentiate between installation bundles/packages and archive files.
- Somewhat support for .zip files will remain because the stock file manager does not have support for mozPkg, but OmniSD Builds can easily be modified to accept mozPkg files.
- mozPackages should be associated with the 'shopping' Gaia Icon. A coffee icon was considered but removed because of the association with J2ME archives.
- It is suggested to, produce a mozPkg and App Installation Bundle along with the builds of your application. Applications above 900 KB should be installed using a mozPackage.

### .webPkg // Equal to application.zip inside a mozPkg, used by WebIDE as a folder // application/x-web-package

### .aib // App Installation Bundle // application/x-install-bundle

This standard is being revised. Please use the mozPackage while this is still being implemented. It is still suggested to build an .aib file along with .mozPkg files.

application.zip > Application Insides (HTML, CSS, JS), without manifest.webapp
application.webmanifest > manifest.webapp

Installation procedure

1. AIB Installer unzips .aib file
2. AIB Installer checks webmanifest for regulations placed by WebIDE

-- OMNISD CONVERSION --
3. AIB Installer creates a /tmp/aib-install/ folder
4. AIB Installer unzips application.zip, places webmanifest inside as manifest.webapp, 
   zips application back
5. AIB Installer proceeds to create a mozApps/OmniSD Package (metadata.json, etc.)
   from webmanifest data and application.zip
6. AIB Installer uses mozApps.mgmt.import to install OmniSD Package.
[PROS] Install using mozApps [CONS] Why not just use OmniSD Package instead of doing all of this

-- BUNDLED INSTALLATION --
3. AIB Installer creates a /tmp/aib-install/ folder
4. AIB Installer converts the package to the standard webapps folder applications found in /data/local/webapps
5. AIB Installer manually places application in webapps and patches webapps.json
[PROS] Does not convert to OmniSD [CONS] Patched webapps.json requires reboot

[SOLUTION] Use self-debug by Affe Nulle to install similiarly to WebIDE
   
 