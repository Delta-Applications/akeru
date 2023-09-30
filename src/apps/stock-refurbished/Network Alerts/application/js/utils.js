'use strict';const GSM_CMAS_LOWER_BOUND=4370;const GSM_CMAS_UPPER_BOUND=4400;const CDMA_CMAS_LOWER_BOUND=4096;const CDMA_CMAS_UPPER_BOUND=4351;const GSM_CMAS_EXTERNAL_LANGUAGE_SUPPORT_LOWER_BOUND=4383;const GSM_CMAS_EXTERNAL_LANGUAGE_SUPPORT_UPPER_BOUND=4395;const ETWS_WARNINGTYPE_EARTHQUAKE=4352;const ETWS_WARNINGTYPE_TSUNAMI=4353;const ETWS_WARNINGTYPE_EARTHQUAKE_TSUNAMI=4354;const ETWS_WARNINGTYPE_TEST=4355;const ETWS_WARNINGTYPE_OTHER=4356;const ETWS_WARNINGTYPE_EXTENSION_LOWER_BOUND=4357;const ETWS_WARNINGTYPE_EXTENSION_UPPER_BOUND=4359;const Utils={DEBUG:true,name:'utils',expireTime:24*60*60*1000,operatorName:'ST',preAlertTW:'presidential-alert-tw',rmtAlertTW:'rmt-alert-tw',emergencyAlertEnglish:'emergency-alert',emergencyMessageEnglish:'alert-message',preAlertChinese:'pre-alert-chinese',emergencyAlertChinese:'emergency-alert-chinese',emergencyMessageChinese:'emergency-message-chinese',rmtMessageChinese:'rmt-message-chinese',wartimeAlertKorea:'network_alert_wartime_alert_korea',emergencyAlertKorea:'network_alert_emergency_korea',notificationKorea:'network_alert_notification_korea',textMessageKorea:'network_alert_text_message_korea',nationalEmergencyAlertArabic:'qtn_cb_uae_national_ar',emergencyAlertArabic:'qtn_cb_uae_emergency_ar',warningAlertArabic:'warning-alert-arabic',testAlertArabic:'qtn_cb_uae_test_ar',exerciseArabic:'qtn_cb_uae_public_ar',nationalEmergencyAlertEnglish:'qtn_cb_uae_national_en',warningAlertEnglist:'qtn_cb_uae_emergency_en',testAlertEnglish:'qtn_cb_uae_test_en',exerciseEnglish:'qtn_cb_uae_public_en',extremeAlertHebrew:'extreme-alert-hebrew',warningNotificationHebrew:'warning-notification-hebrew',informationalHebrew:'informational-hebrew',testHebrew:'test-hebrew',exerciseHebrew:'exercise-hebrew',assistanceHebrew:'assistance-hebrew',informationalEnglish:'informational-english',extremeAlertEnglish:'extreme-alert-english',warningNotificationEnglish:'warning-notification-english',testEnglish:'test-english',assistanceEnglish:'assistance-english',nationalEmergencyAlertLithuanian:'national-emergency-alert-lithuanian',emergencyAlertLithuanian:'emergency-alert-lithuanian',warningAlertLithuanian:'warning-alert-lithuanian',amberAlertLithuanian:'amber-alert-lithuanian',testLithuanian:'test-Lithuanian',alertNetherlands:'NL-alert',alertRomania:'RO-alert',orangeAlert:'orange-alert',alertGreece:'GR-alert',preAlert:'presidential-alert',extremeAlert:'extreme-alert',severeAlert:'severe-alert',amberAlert:'amber-alert',rmtTestAlert:'rmt-alert',exerciseAlert:'exercise-alert',operatorAlert:'operator-alert',safetyAlert:'public-safety-alert',localWEATest:'wea-test',unknownAlert:'unknown-alert',clPreAlert:'qtn_cb_chl_emergency_es_us',clRmtTestAlert:'qtn_cb_chl_test_Prueba_es_us',preAlertHKEnlish:'qtn_cb_hkg_Emergency_msgttl_en',preAlertHKChinese:'qtn_cb_hkg_Emergency_msgttl_zh_hk',emergencyAlertHKEnlish:'qtn_cb_hkg_extre_em_msgttl_en',emergencyAlertchinese:'qtn_cb_hkg_extre_em_msgttl_zh_hk',testAlertHKEnlish:'qtn_cb_hkg_Test_msgttl_en',testAlertHKchinese:'qtn_cb_hkg_Test_msgttl_zh_hk',CMAS_ENABLED_KEY:'cmas.enabled',CMAS_PRESIDENTIAL_ENABLED_KEY:'cmas.presidential.enabled',CMAS_EXTREME_ENABLED_KEY:'cmas.extreme.enabled',CMAS_SEVERE_ENABLED_KEY:'cmas.severe.enabled',CMAS_AMBER_ENABLED_KEY:'cmas.amber.enabled',CMAS_RMT_TEST_ENABLED_KEY:'cmas.monthlytest.enabled',CMAS_EXERCISE_ENABLED_KEY:'cmas.exercise.enabled',CMAS_OPERATOR_ENABLED_KEY:'cmas.operator.enabled',CMAS_SAFETY_ENABLED_KEY:'cmas.safety.enabled',CMAS_WEA_TEST_ENABLED_KEY:'cmas.weatest.enabled',CMAS_MULTI_LANGUAGE_SUPPORT_KEY:'cmas.multi.language.support',EMERGENCY_ALERT_TW_KEY:'emergency.alert.tw.enabled',EMERGENCY_MESSAGE_TW_KEY:'emergency.message.tw.enabled',CMAS_ASSISTANCE_IL_KEY:'cmas.assistance.il.enabled',CMAS_NL_ALERT_ENABLED_KEY:'cmas.nl.alert.enabled',CMAS_IT_ALERT_ENABLED_KEY:'cmas.it.alert.enabled',CMAS_EVW_SPANISH_KEY:'cmas.spanish.alert.enabled',emergencyAlertPeru:'cmas-emergency-alert-peru',testAlertPeru:'cmas-test-alert-peru',messageAlertPeru:'cmas-extreme-alert-peru',exerciseAlertPeru:'cmas-exercise-alert-peru',emergencyAlertMexico:'presidential-alert_mexico',severeAlertMexico:'severe-alert_mexico',extremeAlertMexico:'extreme-alert_mexico',emergencyAlertOmn:'qtn_cb_omn_title_emergency_en',warningAlertOmn:'qtn_cb_omn_title_warning_en',exerciseAlertOmn:'qtn_cb_omn_title_exercises_en',amberAlertArKsa:'qtn_cb_ksa_alerts_title_ar',amberAlertEnKsa:'qtn_cb_ksa_alerts_title_en',warningAlertArKsa:'qtn_cb_ksa_emergency_warn_title_ar',warningAlertEnKsa:'qtn_cb_ksa_emergency_warn_title_en',exerciseAlertArKsa:'qtn_cb_ksa_exercises_title_ar',exerciseAlertEnKsa:'qtn_cb_ksa_exercises_title_en',extremeAlertArKsa:'qtn_cb_ksa_extreme_emer_title_ar',extremeAlertEnKsa:'qtn_cb_ksa_extreme_emer_title_en',nationalAlertEnKsa:'qtn_cb_ksa_national_warn_title_en',nationalAlertArKsa:'qtn_cb_ksa_nationalwarn_title_ar',testAlertArKsa:'qtn_cb_ksa_test_title_ar',testAlertEnKsa:'qtn_cb_ksa_test_title_en',alertItaly:'IT-Alert',GSM_PRESIDENTIAL_ALERTS:[4370,4383],GSM_EXTREME_THREAT_ALERTS:[4371,4372,4384,4385],GSM_SEVERE_THREAT_ALERTS:[4373,4374,4375,4376,4377,4378,4386,4387,4388,4389,4390,4391],GSM_CHILD_ABDUCTION_EMERGENCY_ALERTS:[4379,4392],GSM_RMT_TEST_ALERTS:[4380,4393],GSM_EXERCISE_ALERTS:[4381,4394],GSM_OPERATOR_ALERTS:[4382,4395],GSM_SAFETY_ALERTS:[4396,4397],GSM_LOACAL_WEA_TEST:[4398,4399],CDMA_PRESIDENTIAL_ALERTS:0x1000,CDMA_EXTREME_THREAT_ALERTS:0x1001,CDMA_SEVERE_THREAT_ALERTS:0x1002,CDMA_CHILD_ABDUCTION_EMERGENCY_ALERTS:0x1003,CDMA_TEST_ALERTS:0x1004,CMAS_WARTIME_ALERT_KOREA:[4370],CMAS_EMERGENCY_ALERT_KOREA:[4371],CMAS_INFORMATION_NOTIFICATION_KOREA:[4372],CMAS_TEXT_MESSAGE_KOREA:[4379],CMAS_PRESIDENTIAL_ALERTS_RO:[4370],CMAS_EXTREME_ALERTS_RO:[4371],CMAS_SEVERE_ALERTS_RO:[4375],CMAS_AMBER_ALERTS_RO:[4379],CMAS_EXERCISE_ALERTS_RO:[4381],CMAS_PRESIDENTIAL_ALERTS_GR:[4370],CMAS_EXTREME_ALERTS_GR:[4371],CMAS_SEVERE_ALERTS_GR:[4375],CMAS_AMBER_ALERTS_GR:[4379],CMAS_PRESIDENTIAL_ALERTS_NZL:[4370],CMAS_EXTREME_ALERTS_NZL:[4371],CMAS_SEVERE_ALERTS_NZL:[4373,4374,4375,4376,4377,4378],CHANNEL_FOR_NL:[4371,4372],CHANNEL_4392:4392,STORAGE_COUNT_LIMIT:10,TW_CHANNELS:[919,911],TURKEY_CHANNELS:[112],CMAS_PRESIDENTIAL_ALERTS_CHINESE:[4370],CMAS_PRESIDENTIAL_ALERTS_ENGLISH:[4383],CMAS_EMEGENCY_ALERT_CHINESE:[4371,4372,4373,4374,4375,4376,4377,4378,4379],CMAS_EMEGENCY_ALERT_ENGLISH_TW:[4384,4385,4386,4387,4388,4389,4390,4391,4392],CMAS_ALERT_MESSAGE_CHINESE:[911],CMAS_ALERT_MESSAGE_ENGLISH:[919],CMAS_RMT_CHINESE:[4380],CMAS_RMT_ENGLISH:[4393],CMAS_NATIONAL_EMEGENCY_ALERTS_ARABIC:[4370],CMAS_NATIONAL_EMEGENCY_ALERTS_ENGLISH:[4383],CMAS_EMEGENCY_ALERT_ARABIC:[4371,4372,4373,4374,4375,4376,4377,4378],CMAS_EMEGENCY_ALERT_ENGLISH:[4384,4385,4386,4387,4388,4389,4390,4391],CMAS_WARNING_ALERT_ARABIC:[4379],CMAS_WARNING_ALERT_ENGLISH:[4392],CMAS_TEST_ALERT_ARABIC:[4380],CMAS_TEST_ALERT_ENGLISH:[4393],CMAS_EXERCISE_ARABIC:[4381],CMAS_EXERCISE_ENGLISH:[4394],CMAS_PUBLIC_SAFETY_ALERT_ARABIC:[4396],CMAS_PUBLIC_SAFETY_ALERT_ENGLISH:[4397],CMAS_WEA_TEST_ALERT_ARABIC:[4398],CMAS_WEA_TEST_ALERT_ENGLISH:[4399],CMAS_EXTREME_ALERTS_KSA_EN:[4384,4385],CMAS_EXTREME_ALERTS_KSA_AR:[4371,4372],CMAS_SEVERE_ALERTS_KSA_EN:[4386,4387,4388,4389,4390,4391],CMAS_SEVERE_ALERTS_KSA_AR:[4373,4374,4375,4376,4377,4378],CMAS_EXTREME_ALERT_HEBREW:[4370],CMAS_EXTREME_ALERT_ENGLISH:[4383],CMAS_WARNING_NOTIFICATION_HEBREW:[4371,4372],CMAS_WARNING_NOTIFICATION_ENGLISH:[4384,4385],CMAS_INFORMATIONAL_HEBREW:[4373,4374,4375,4376,4377,4378],CMAS_INFORMATIONAL_ENGLISH:[4386,4387,4388,4389,4390,4391],CMAS_TEST_HEBREW:[4380],CMAS_TEST_ENGLISH:[4393],CMAS_EXERCISE_HEBREW:[4381],CMAS_ASSISTANCE_HEBREW:[4379],CMAS_ASSISTANCE_ENGLISH:[4392],CMAS_NATIONAL_EMEGENCY_ALERTS_LITHUANIAN:[4370],CMAS_EMEGENCY_ALERT_LITHUANIAN:[4371,4372],CMAS_EMEGENCY_ALERT_LIT_ENGLISH:[4384,4385],CMAS_WARNING_ALERT_LITHUANIAN:[4373,4374,4375,4376,4377,4378],CMAS_WARNING_ALERT_LIT_ENGLISH:[4386,4387,4388,4389,4390,4391],CMAS_AMBER_ALERT_LITHUANIAN:[4379],CMAS_AMBER_ALERT_ENGLISH:[4392],CMAS_TEST_LITHUANIAN:[4380],CMAS_EMEGENCY_ALERT_NL:[4371,4372],CMAS_EMEGENCY_ALERT_PE:[50,919,4370,4383],CMAS_MESSAGE_ALERT_PE:[4382],CMAS_EXERCISE_ALERT_PE:[4381],CMAS_TEST_EMEGENCY_ALERT_PE:[519,4380,4396,4397,4398,4399],CMAS_PRESIDENTIAL_ALERTS_HK_ZH:[4370],CMAS_PRESIDENTIAL_ALERTS_HK_EN:[4383],CMAS_EXTREME_THREAT_ALERTS_HK_EN:[4384,4385],CMAS_EXTREME_THREAT_ALERTS_HK_ZH:[4371,4372],CMAS_SEVERE_THREAT_ALERTS_HK_ZH:[4373,4374,4375,4376,4377,4378],CMAS_SEVERE_THREAT_ALERTS_HK_EN:[4386,4387,4388,4389,4390,4391],CMAS_TEST_ALERTS_HK_ZH:[4380],CMAS_TEST_ALERTS_HK_EN:[4393],CMAS_PRESIDENTIAL_ALERTS_IT:[4370,4382],CMAS_LEVEL2_ALERTS_IT:[4371,4375,4379,4384,4388,4392],CMAS_EXERCISE_ALERTS_IT:[4381,4394],CMAS_ADDITIONAL_LANGUAGES_ALERT_IT:[4383,4384,4388,4392,4394],CMAS_TEST_ALERT_IT:[4396,4397,4398,4399],CMAS_TEST_ALERT_UK:[4380,4381,4393,4394],CMAS_UK_TEST_ALERT_ENABLED_KEY:'cmas.uk.test.alert.enabled',GovernmentEmergencyAlert:'Government-Alert',CMAS_INFO_ALERT_EU:[6400],CMAS_TEST_ALERT_EU:[4380,519],CMAS_INFO_ALERT_ENABLED_KEY:'cmas.info.alert.enabled',presidentialAlertEU:'presidential-alert-EU',informationAlertEU:'information-alert-EU',testAlertEU:'test-alert-EU',exerciseAlertEU:'exercise-alert-EU ',debug(s){if(this.DEBUG){console.log(`-*- CMAS ${this.name} -*- ${s}`);}},isGSMMsg(message){let serviceCategory=message.cdmaServiceCategory;return!serviceCategory||(-1===serviceCategory);},isWEAMsg(message){if(message.cdmaServiceCategory){return(message.cdmaServiceCategory>=CDMA_CMAS_LOWER_BOUND&&message.cdmaServiceCategory<=CDMA_CMAS_UPPER_BOUND);}else{return(message.messageId>=GSM_CMAS_LOWER_BOUND&&message.messageId<GSM_CMAS_UPPER_BOUND);}},isETWSAlert(message){if(message.etws){return(message.messageId===ETWS_WARNINGTYPE_EARTHQUAKE||message.messageId===ETWS_WARNINGTYPE_TSUNAMI||message.messageId===ETWS_WARNINGTYPE_EARTHQUAKE_TSUNAMI||message.messageId===ETWS_WARNINGTYPE_TEST||message.messageId===ETWS_WARNINGTYPE_OTHER||(message.messageId>=ETWS_WARNINGTYPE_EXTENSION_LOWER_BOUND&&message.messageId<=ETWS_WARNINGTYPE_EXTENSION_UPPER_BOUND));}else{return false;}},isEmergencyAlert(message){return this.isWEAMsg(message)||this.isETWSAlert(message);},isSupportMultiLanguage(message){let supportMultiLanguage=false;if(this.isGSMMsg(message)){supportMultiLanguage=message.messageId>=GSM_CMAS_EXTERNAL_LANGUAGE_SUPPORT_LOWER_BOUND&&message.messageId<=GSM_CMAS_EXTERNAL_LANGUAGE_SUPPORT_UPPER_BOUND;}
return supportMultiLanguage;},isPresidentialAlert(message){return this.GSM_PRESIDENTIAL_ALERTS.indexOf(message.messageId)!==-1||message.cdmaServiceCategory===this.CDMA_PRESIDENTIAL_ALERTS;},isCmasEnabled(message){let cardIndex=message.serviceId||0;return this.getSettingsValue(this.CMAS_ENABLED_KEY).then((result)=>{return!!(result[cardIndex]);});},getMessageInfoForTW(messageId){let sets={};if(this.CMAS_PRESIDENTIAL_ALERTS_CHINESE.indexOf(messageId)!==-1){sets.type=this.preAlertChinese;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_PRESIDENTIAL_ALERTS_ENGLISH.indexOf(messageId)!==-1){sets.type=this.preAlertTW;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EMEGENCY_ALERT_CHINESE.indexOf(messageId)!==-1){sets.type=this.emergencyAlertChinese;sets.key=this.EMERGENCY_ALERT_TW_KEY;}else if(this.CMAS_EMEGENCY_ALERT_ENGLISH_TW.indexOf(messageId)!==-1){sets.type=this.emergencyAlertEnglish;sets.key=this.EMERGENCY_ALERT_TW_KEY;}else if(this.CMAS_ALERT_MESSAGE_CHINESE.indexOf(messageId)!==-1){sets.type=this.emergencyMessageChinese;sets.key=this.EMERGENCY_MESSAGE_TW_KEY;}else if(this.CMAS_ALERT_MESSAGE_ENGLISH.indexOf(messageId)!==-1){sets.type=this.emergencyMessageEnglish;sets.key=this.EMERGENCY_MESSAGE_TW_KEY;}else if(this.CMAS_RMT_CHINESE.indexOf(messageId)!==-1){sets.type=this.rmtMessageChinese;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else if(this.CMAS_RMT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.rmtAlertTW;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForUAE(messageId){let sets={};if(this.CMAS_NATIONAL_EMEGENCY_ALERTS_ARABIC.indexOf(messageId)!==-1){sets.type=this.nationalEmergencyAlertArabic;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_NATIONAL_EMEGENCY_ALERTS_ENGLISH.indexOf(messageId)!==-1){sets.type=this.nationalEmergencyAlertEnglish;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EMEGENCY_ALERT_ARABIC.indexOf(messageId)!==-1){sets.type=this.emergencyAlertArabic;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_EMEGENCY_ALERT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.emergencyAlertEnglish;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_WARNING_ALERT_ARABIC.indexOf(messageId)!==-1){sets.type=this.warningAlertArabic;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_WARNING_ALERT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.warningAlertEnglish;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_TEST_ALERT_ARABIC.indexOf(messageId)!==-1){sets.type=this.testAlertArabic;sets.key=this.CMAS_WEA_TEST_ENABLED_KEY;}else if(this.CMAS_TEST_ALERT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.testAlertEnglish;sets.key=this.CMAS_WEA_TEST_ENABLED_KEY;}else if(this.CMAS_PUBLIC_SAFETY_ALERT_ARABIC.indexOf(messageId)!==-1){sets.type=this.exerciseArabic;sets.key=this.CMAS_SAFETY_ENABLED_KEY;}else if(this.CMAS_PUBLIC_SAFETY_ALERT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.exerciseEnglish;sets.key=this.CMAS_SAFETY_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForIL(messageId){let sets={};if(this.CMAS_EXTREME_ALERT_HEBREW.indexOf(messageId)!==-1){sets.type=this.extremeAlertHebrew;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EXTREME_ALERT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.extremeAlertEnglish;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_WARNING_NOTIFICATION_HEBREW.indexOf(messageId)!==-1){sets.type=this.warningNotificationHebrew;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_WARNING_NOTIFICATION_ENGLISH.indexOf(messageId)!==-1){sets.type=this.warningNotificationEnglish;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_INFORMATIONAL_HEBREW.indexOf(messageId)!==-1){sets.type=this.informationalHebrew;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_INFORMATIONAL_ENGLISH.indexOf(messageId)!==-1){sets.type=this.informationalEnglish;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_TEST_HEBREW.indexOf(messageId)!==-1){sets.type=this.testHebrew;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else if(this.CMAS_TEST_ENGLISH.indexOf(messageId)!==-1){sets.type=this.testEnglish;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else if(this.CMAS_EXERCISE_HEBREW.indexOf(messageId)!==-1){sets.type=this.exerciseHebrew;sets.key=this.CMAS_EXERCISE_ENABLED_KEY;}else if(this.CMAS_EXERCISE_ENGLISH.indexOf(messageId)!==-1){sets.type=this.exerciseEnglish;sets.key=this.CMAS_EXERCISE_ENABLED_KEY;}else if(this.CMAS_ASSISTANCE_HEBREW.indexOf(messageId)!==-1){sets.type=this.assistanceHebrew;sets.key=this.CMAS_ASSISTANCE_IL_KEY;}else if(this.CMAS_ASSISTANCE_ENGLISH.indexOf(messageId)!==-1){sets.type=this.assistanceEnglish;sets.key=this.CMAS_ASSISTANCE_IL_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForLT(messageId){let sets={};if(this.CMAS_NATIONAL_EMEGENCY_ALERTS_LITHUANIAN.indexOf(messageId)!==-1){sets.type=this.nationalEmergencyAlertLithuanian;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_NATIONAL_EMEGENCY_ALERTS_ENGLISH.indexOf(messageId)!==-1){sets.type=this.nationalEmergencyAlertEnglish;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EMEGENCY_ALERT_LITHUANIAN.indexOf(messageId)!==-1){sets.type=this.emergencyAlertLithuanian;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_EMEGENCY_ALERT_LIT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.emergencyAlertEnglish;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_WARNING_ALERT_LITHUANIAN.indexOf(messageId)!==-1){sets.type=this.warningAlertLithuanian;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.CMAS_WARNING_ALERT_LIT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.warningAlertEnglish;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.CMAS_AMBER_ALERT_LITHUANIAN.indexOf(messageId)!==-1){sets.type=this.amberAlertLithuanian;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_AMBER_ALERT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.amberAlert;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_TEST_ALERT_ARABIC.indexOf(messageId)!==-1){sets.type=this.testLithuanian;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else if(this.CMAS_TEST_ALERT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.testEnglish;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForNL(messageId){let sets={};if(this.GSM_PRESIDENTIAL_ALERTS.indexOf(messageId)!==-1){sets.type=this.preAlert;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EMEGENCY_ALERT_NL.indexOf(messageId)!==-1){sets.type=this.alertNetherlands;sets.key=this.CMAS_NL_ALERT_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForKR(messageId){let sets={};if(this.CMAS_WARTIME_ALERT_KOREA.indexOf(messageId)!==-1){sets.type=this.wartimeAlertKorea;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EMERGENCY_ALERT_KOREA.indexOf(messageId)!==-1){sets.type=this.emergencyAlertKorea;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_INFORMATION_NOTIFICATION_KOREA.indexOf(messageId)!==-1){sets.type=this.notificationKorea;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.CMAS_TEXT_MESSAGE_KOREA.indexOf(messageId)!==-1){sets.type=this.textMessageKorea;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForRO(messageId){let sets={};if(this.CMAS_PRESIDENTIAL_ALERTS_RO.indexOf(messageId)!==-1){sets.type=this.preAlert;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EXTREME_ALERTS_RO.indexOf(messageId)!==-1){sets.type=this.extremeAlert;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_SEVERE_ALERTS_RO.indexOf(messageId)!==-1){sets.type=this.severeAlert;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.CMAS_AMBER_ALERTS_RO.indexOf(messageId)!==-1){sets.type=this.orangeAlert;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_EXERCISE_ALERTS_RO.indexOf(messageId)!==-1){sets.type=this.exerciseAlert;sets.key=this.CMAS_EXERCISE_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForGR(messageId){let sets={};if(this.CMAS_PRESIDENTIAL_ALERTS_GR.indexOf(messageId)!==-1){sets.type=this.alertGreece;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EXTREME_ALERTS_GR.indexOf(messageId)!==-1){sets.type=this.alertGreece;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_SEVERE_ALERTS_GR.indexOf(messageId)!==-1){sets.type=this.alertGreece;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.CMAS_AMBER_ALERTS_GR.indexOf(messageId)!==-1){sets.type=this.alertGreece;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForNZL(messageId){let sets={};if(this.CMAS_PRESIDENTIAL_ALERTS_NZL.indexOf(messageId)!==-1){sets.type=this.preAlert;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EXTREME_ALERTS_NZL.indexOf(messageId)!==-1){sets.type=this.extremeAlert;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_SEVERE_ALERTS_NZL.indexOf(messageId)!==-1){sets.type=this.severeAlert;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForPe(messageId){let sets={};if(this.CMAS_EMEGENCY_ALERT_PE.indexOf(messageId)!==-1){sets.type=this.emergencyAlertPeru;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_MESSAGE_ALERT_PE.indexOf(messageId)!==-1){sets.type=this.messageAlertPeru;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_EXERCISE_ALERT_PE.indexOf(messageId)!==-1){sets.type=this.exerciseAlertPeru;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_TEST_EMEGENCY_ALERT_PE.indexOf(messageId)!==-1){sets.type=this.testAlertPeru;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForCl(messageId){let sets={};MessageManager.disablePeriodReminder();if(this.GSM_PRESIDENTIAL_ALERTS.indexOf(messageId)!==-1){sets.type=this.clPreAlert;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.GSM_RMT_TEST_ALERTS.indexOf(messageId)!==-1){sets.type=this.clRmtTestAlert;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForHK(messageId){let sets={};if(this.CMAS_PRESIDENTIAL_ALERTS_HK_ZH.indexOf(messageId)!==-1){sets.type=this.preAlertHKChinese;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_PRESIDENTIAL_ALERTS_HK_EN.indexOf(messageId)!==-1){sets.type=this.preAlertHKEnlish;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EXTREME_THREAT_ALERTS_HK_EN.indexOf(messageId)!==-1){sets.type=this.emergencyAlertHKEnlish;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_EXTREME_THREAT_ALERTS_HK_ZH.indexOf(messageId)!==-1){sets.type=this.emergencyAlertchinese;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_SEVERE_THREAT_ALERTS_HK_ZH.indexOf(messageId)!==-1){sets.type=this.emergencyAlertchinese;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_SEVERE_THREAT_ALERTS_HK_EN.indexOf(messageId)!==-1){sets.type=this.emergencyAlertHKEnlish;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_TEST_ALERTS_HK_ZH.indexOf(messageId)!==-1){sets.type=this.testAlertHKchinese;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else if(this.CMAS_TEST_ALERTS_HK_EN.indexOf(messageId)!==-1){sets.type=this.testAlertHKEnlish;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForMX(messageId){let sets={};if(this.GSM_PRESIDENTIAL_ALERTS.indexOf(messageId)!==-1){sets.type=this.emergencyAlertMexico;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.GSM_SEVERE_THREAT_ALERTS.indexOf(messageId)!==-1){sets.type=this.severeAlertMexico;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.GSM_EXTREME_THREAT_ALERTS.indexOf(messageId)!==-1){sets.type=this.extremeAlertMexico;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForOM(messageId){let sets={};if(this.CMAS_PRESIDENTIAL_ALERTS_RO.indexOf(messageId)!==-1){sets.type=this.emergencyAlertKsa;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EXTREME_ALERTS_RO.indexOf(messageId)!==-1){sets.type=this.warningAlertKsa;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_EXERCISE_ALERTS_RO.indexOf(messageId)!==-1){sets.type=this.exerciseAlertKsa;sets.key=this.CMAS_EXERCISE_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForKSA(messageId){let sets={};if(this.CMAS_NATIONAL_EMEGENCY_ALERTS_ARABIC.indexOf(messageId)!==-1){sets.type=this.nationalAlertArKsa;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_NATIONAL_EMEGENCY_ALERTS_ENGLISH.indexOf(messageId)!==-1){sets.type=this.nationalAlertEnKsa;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_EXTREME_ALERTS_KSA_AR.indexOf(messageId)!==-1){sets.type=this.extremeAlertArKsa;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_EXTREME_ALERTS_KSA_EN.indexOf(messageId)!==-1){sets.type=this.extremeAlertEnKsa;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.CMAS_SEVERE_ALERTS_KSA_AR.indexOf(messageId)!==-1){sets.type=this.warningAlertArKsa;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.CMAS_SEVERE_ALERTS_KSA_EN.indexOf(messageId)!==-1){sets.type=this.warningAlertEnKsa;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.CMAS_WARNING_ALERT_ARABIC.indexOf(messageId)!==-1){sets.type=this.amberAlertArKsa;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_WARNING_ALERT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.amberAlertEnKsa;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.CMAS_TEST_ALERT_ARABIC.indexOf(messageId)!==-1){sets.type=this.testAlertArKsa;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else if(this.CMAS_TEST_ALERT_ENGLISH.indexOf(messageId)!==-1){sets.type=this.testAlertEnKsa;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else if(this.CMAS_EXERCISE_ARABIC.indexOf(messageId)!==-1){sets.type=this.exerciseAlertArKsa;sets.key=this.CMAS_EXERCISE_ENABLED_KEY;}else if(this.CMAS_EXERCISE_ENGLISH.indexOf(messageId)!==-1){sets.type=this.exerciseAlertEnKsa;sets.key=this.CMAS_EXERCISE_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForIT(messageId){let sets={};if(this.CMAS_PRESIDENTIAL_ALERTS_IT.indexOf(messageId)!==-1){sets.type=this.alertItaly;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_LEVEL2_ALERTS_IT.indexOf(messageId)!==-1){sets.type=this.alertItaly;sets.key=this.CMAS_IT_ALERT_ENABLED_KEY;}else if(this.CMAS_EXERCISE_ALERTS_IT.indexOf(messageId)!==-1){sets.type=this.alertItaly;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}
return sets;},getMessageInfoForUK(messageId){let sets={};if(this.GSM_PRESIDENTIAL_ALERTS.indexOf(messageId)!==-1){sets.type=this.GovernmentEmergencyAlert;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.GSM_EXTREME_THREAT_ALERTS.indexOf(messageId)!==-1){sets.type=this.extremeAlert;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.GSM_SEVERE_THREAT_ALERTS.indexOf(messageId)!==-1){sets.type=this.severeAlert;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.CMAS_TEST_ALERT_UK.indexOf(messageId)!==-1){sets.type=this.testAlertEnglish;sets.key=this.CMAS_UK_TEST_ALERT_ENABLED_KEY;}else if(this.GSM_OPERATOR_ALERTS.indexOf(messageId)!==-1){sets.type=this.operatorAlert;sets.key=this.CMAS_OPERATOR_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getMessageInfoForEU(messageId){let sets={};MessageManager.disablePeriodReminder();if(this.CMAS_WARTIME_ALERT_KOREA.indexOf(messageId)!==-1){sets.type=this.presidentialAlertEU;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else if(this.CMAS_INFO_ALERT_EU.indexOf(messageId)!==-1){info.type=this.informationAlertEU;sets.key=this.CMAS_INFO_ALERT_ENABLED_KEY;}else if(this.CMAS_TEST_ALERT_EU.indexOf(messageId)!==-1){sets.type=this.testAlertEU;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else if(this.CMAS_EXERCISE_ALERT_PE.indexOf(messageId)!==-1){sets.type=this.exerciseAlertEU;sets.key=this.CMAS_EXERCISE_ENABLED_KEY;}else{sets.key=this.unknownAlert;}
return sets;},getDefaultMessageInfo(message){let sets={};let messageId=message.messageId;let isGSM=this.isGSMMsg(message);let cdmaServiceCategory=message.cdmaServiceCategory;if(this.isPresidentialAlert(message)){sets.type=this.preAlert;sets.key=this.CMAS_PRESIDENTIAL_ENABLED_KEY;}else{if(isGSM){if(this.GSM_EXTREME_THREAT_ALERTS.indexOf(messageId)!==-1){sets.type=this.extremeAlert;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(this.GSM_SEVERE_THREAT_ALERTS.indexOf(messageId)!==-1){sets.type=this.severeAlert;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(this.GSM_CHILD_ABDUCTION_EMERGENCY_ALERTS.indexOf(messageId)!==-1){sets.type=this.amberAlert;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(this.GSM_RMT_TEST_ALERTS.indexOf(messageId)!==-1){sets.type=this.rmtTestAlert;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else if(this.GSM_EXERCISE_ALERTS.indexOf(messageId)!==-1){sets.type=this.exerciseAlert;sets.key=this.CMAS_EXERCISE_ENABLED_KEY;}else if(this.GSM_OPERATOR_ALERTS.indexOf(messageId)!==-1){sets.type=this.operatorAlert;sets.key=this.CMAS_OPERATOR_ENABLED_KEY;}else if(this.GSM_SAFETY_ALERTS.indexOf(messageId)!==-1){sets.type=this.safetyAlert;sets.key=this.CMAS_SAFETY_ENABLED_KEY;}else if(this.GSM_LOACAL_WEA_TEST.indexOf(messageId)!==-1){sets.type=this.localWEATest;sets.key=this.CMAS_WEA_TEST_ENABLED_KEY;}else{sets.key=this.unknownAlert;}}else{if(cdmaServiceCategory===this.CDMA_EXTREME_THREAT_ALERTS){sets.type=this.extremeAlert;sets.key=this.CMAS_EXTREME_ENABLED_KEY;}else if(cdmaServiceCategory===this.CDMA_SEVERE_THREAT_ALERTS){sets.type=this.severeAlert;sets.key=this.CMAS_SEVERE_ENABLED_KEY;}else if(cdmaServiceCategory===this.CDMA_CHILD_ABDUCTION_EMERGENCY_ALERTS){sets.type=this.amberAlert;sets.key=this.CMAS_AMBER_ENABLED_KEY;}else if(cdmaServiceCategory===this.CDMA_TEST_ALERTS){sets.type=this.rmtTestAlert;sets.key=this.CMAS_RMT_TEST_ENABLED_KEY;}else{sets.key=this.unknownAlert;}}}
return sets;},getInfoDependOnOperator(operator,message){let info={};let messageId=message.messageId;if(operator==='TW'){info=this.getMessageInfoForTW(messageId);}else if(operator==='UAE'){info=this.getMessageInfoForUAE(messageId);}else if(operator==='IL'){info=this.getMessageInfoForIL(messageId);}else if(operator==='LT'){info=this.getMessageInfoForLT(messageId);}else if(operator==='NL'){info=this.getMessageInfoForNL(messageId);}else if(operator==='KR'){info=this.getMessageInfoForKR(messageId);}else if(operator==='RO'){info=this.getMessageInfoForRO(messageId);}else if(operator==='GR'){info=this.getMessageInfoForGR(messageId);}else if(operator==='NZL'){info=this.getMessageInfoForNZL(messageId);}else if(operator==='Pe'){info=this.getMessageInfoForPe(messageId);}else if(operator==='cl'){info=this.getMessageInfoForCl(messageId);}else if(operator==='HK'){info=this.getMessageInfoForHK(messageId);}else if(operator==='MX'){info=this.getMessageInfoForMX(messageId);}else if(operator==='OM'){info=this.getMessageInfoForOM(messageId);}else if(operator==='KSA'){info=this.getMessageInfoForKSA(messageId);}else if(operator==='IT'){info=this.getMessageInfoForIT(messageId);}else if(operator==='UK'){info=this.getMessageInfoForUK(messageId);}else if(operator==='EU'){this.debug("getInfoDependOnOperator ");info=this.getMessageInfoForEU(messageId);}else{info=this.getDefaultMessageInfo(message);}
return info;},getCmasMessageInfo(message,callback){navigator.customization.getValue("def.operator.name").then((operator)=>{let info={};const messageId=message.messageId;const isGSM=this.isGSMMsg(message);const cdmaServiceCategory=message.cdmaServiceCategory;this.debug("JWJ:getCmasMessageInfo operatorName "+operator+" Message id is "+messageId+" isGSM "+isGSM);info=this.getInfoDependOnOperator(operator,message);let checkSpecificTypeMessage=(m_info,m_callback)=>{if(m_info.key!==this.unknownAlert){this.getSettingsValue(m_info.key).then((result)=>{if(result===undefined){result=m_info.type!==this.rmtTestAlert&&m_info.type!==this.exerciseAlert&&m_info.type!==this.operatorAlert&&m_info.type!==this.localWEATest;}
m_info.receive=result;if(m_callback){m_callback(m_info);}});}else{this.debug('cellbroadcast message type is unknown.');}};if(this.isSupportMultiLanguage(message)){let multiLanguageSupportKey=this.CMAS_MULTI_LANGUAGE_SUPPORT_KEY;this.getSettingsValue(multiLanguageSupportKey).then((result)=>{this.debug(`isSupportExternalLanguage -> ${result}`);if(!!result||(result===undefined)){checkSpecificTypeMessage(info,callback);}else{info.receive=false;if(callback){callback(info);}}});}else{checkSpecificTypeMessage(info,callback);}});},isSameMsgId(message_old,message_new){let isSame=false;if(message_new.messageId){isSame=(message_old.messageId===message_new.messageId);}
return isSame;},isSameMsgSerialNumber(message_old,message_new){let isSame=false;if(message_new.messageCode){isSame=(message_old.messageCode===message_new.messageCode);}
return isSame;},isSameMsg(message_old,message_new,bGsm){if(bGsm){return this.isSameMsgId(message_old,message_new)&&this.isSameMsgSerialNumber(message_old,message_new);}else{return this.isSameMsgId(message_old,message_new);}},sendAlert(msg){let url=['attention.html?title=',encodeURIComponent(msg.messageType),'&date=',encodeURIComponent(msg.timestamp),'&body=',encodeURIComponent(msg.body),'&id=',encodeURIComponent(msg.id)].join('');return window.open(url,'_blank','attention');},setWakeLock(mode){this.debug(`setWakeLock mode -> ${mode}`);switch(mode){case'cpu':this.cpuLock=navigator.requestWakeLock('cpu');break;case'screen':this.screenLock=navigator.requestWakeLock('screen');break;default:this.cpuLock=navigator.requestWakeLock('cpu');this.screenLock=navigator.requestWakeLock('screen');break;}},clearWakeLock(){this.debug('clearWakeLock.');if(null!==this.screenLock){this.screenLock.unlock();this.screenLock=null;}
if(null!==this.cpuLock){this.cpuLock.unlock();this.cpuLock=null;}},getSettingsValue(key){return new Promise((resolve,reject)=>{let req=navigator.mozSettings.createLock().get(key);req.onsuccess=()=>{resolve(req.result[key]);};req.onerror=()=>{reject('Cannot get this settings value');};});},setSettingsValue(key,value){let data={};data[key]=value;return new Promise((resolve,reject)=>{let req=navigator.mozSettings.createLock().set(data);req.onsuccess=()=>{resolve(true);};req.onerror=()=>{reject('Cannot write this settings value to settings database.');};});},getOperatorName(){navigator.customization.getValue("def.operator.name").then((operator)=>{this.debug('getOperator operator--> '+operator);if(operator!==undefined){this.operatorName=operator;return Promise.resolve(operator);}});},isCustomForTurkey(id){let isTurkey=false;if(TURKEY_CHANNELS.indexOf(id)!==-1){isTurkey=true;}
return isTurkey;},isTWChannels(id){var isTWChannels=false;if(TW_CHANNELS.indexOf(id)!==-1){isTWChannels=true;this.debug("isTWChannels "+isTWChannels);}
return isTWChannels;},isOperatorChannels(messageId){var id=parseInt(messageId);return this.isCustomForTurkey(id)||this.isTWChannels(id);},ITLangueageCheck(message){if(typeof(message)!=='object'){return Promise.resolve(false);}
let messageLanguage=message.language;let messageId=message.messageId;this.debug("ITLangueageCheck messageLanguage is "+messageLanguage+" messageId: "+messageId);return navigator.customization.getValue("def.operator.name").then((operator)=>{this.debug("ITLangueageCheck current.language "+navigator.language+" operator: "+operator);if(operator==='IT'&&this.CMAS_ADDITIONAL_LANGUAGES_ALERT_IT.indexOf(messageId)!==-1){if(messageLanguage!==navigator.language){return Promise.resolve(true);}else{return Promise.resolve(false);}}else if(operator==='IT'&&this.CMAS_TEST_ALERT_IT.indexOf(messageId)!==-1){return Promise.resolve(true);}else if(operator=='VZW'){if(messageLanguage.indexOf('es')!==-1){return this.getSettingsValue(this.CMAS_EVW_SPANISH_KEY).then((result)=>{return Promise.resolve(result);});}else{return Promise.resolve(true);}}else{return Promise.resolve(false);}});}};