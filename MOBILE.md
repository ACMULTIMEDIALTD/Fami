# האפליקציה לאייפון ולאנדרואיד

אותה אפליקציה (React) רצה בשלוש צורות:

| | מה זה | מה צריך |
|---|---|---|
| **אתר שאפשר להתקין (PWA)** | יוצרת פותחת את הקישור מהווטסאפ ומוסיפה למסך הבית. מקבלת אייקון ומסך מלא. | כלום. עובד ברגע שהאתר באוויר. |
| **אפליקציית אנדרואיד** | `client/android`, פרויקט Android Studio | חשבון Google Play Console ($25, תשלום חד־פעמי) |
| **אפליקציית אייפון** | `client/ios`, פרויקט Xcode | חשבון Apple Developer ($99 לשנה). את הבנייה עושה גיטהאב בענן, בלי Mac (ראו למטה) |

שתי האפליקציות נבנו עם Capacitor. הן מציגות את אותם מסכים כמו האתר ומדברות עם אותו שרת, ומוסיפות:
- **התראות פוש:** קמפיין חדש שמתאים ליוצרת, "נבחרת!", וחברות שאושרה.
- **קישורים שנפתחים באפליקציה:** קישור קמפיין מהווטסאפ (`/c/...`) וקישור כניסה מהמייל (`/m/...`).
- **חיבור שנשמר:** אין צורך להתחבר מחדש בכל פעם.

> Apple דוחה לפעמים אפליקציות שהן "רק אתר בתוך מסגרת" (סעיף 4.2 בהנחיות שלה). התראות הפוש והקישורים שנפתחים באפליקציה הם בדיוק מה שמבדיל את האפליקציה מאתר, אז כדאי להגדיר אותם לפני ההגשה.

## גרסת הדגמה לאנדרואיד (בלי שרת)

`npm run build:app-demo && npx cap sync android` ואז `./gradlew assembleDebug` בתיקייה `client/android`. נוצר קובץ APK עם נתונים לדוגמה שאפשר להתקין ישירות על טלפון.
גם תהליך **Mobile apps** בגיטהאב בונה את הקובץ בכל דחיפה. אפשר להוריד אותו מעמוד ההרצה, בחלק Artifacts.

## לפני ההגשה לחנויות — רשימת החלפות

שם האפליקציה הוא `il.co.noaavital.creatorclub`, ואי אפשר לשנות אותו אחרי ההעלאה הראשונה לחנות. כדאי לבחור עכשיו שם שמבוסס על דומיין שבבעלותכם.
מופיע ב: `client/capacitor.config.json`, `client/android/app/build.gradle`, ‏`client/ios/App/App.xcodeproj/project.pbxproj`, ‏`client/public/.well-known/*`, ‏`APNS_BUNDLE_ID`.

| מה | איפה |
|---|---|
| כתובת השרת (Render) | `client/.env.app` → `VITE_API_URL` |
| הדומיין של האתר (כבר מוגדר: `club.noaavital.co.il`) | `client/android/gradle.properties` → `appLinkHost`, ‏`client/ios/App/App/App.entitlements` → `applinks:` |
| Apple Team ID | `client/public/.well-known/apple-app-site-association` |
| טביעת האצבע (SHA-256) של חתימת Google Play | `client/public/.well-known/assetlinks.json` (נמצאת ב-Play Console ← App integrity) |

## התראות פוש

- **אייפון:** ב-developer.apple.com ← Keys ← יוצרים מפתח עם הרשאת APNs. ממלאים בשרת (Render) את `APNS_KEY` (תוכן קובץ ה-‎.p8), ‏`APNS_KEY_ID`, ‏`APNS_TEAM_ID` ו-`APNS_BUNDLE_ID`. ב-Xcode מוסיפים ל-target את היכולת Push Notifications (קובץ ההרשאות כבר מוכן).
- **אנדרואיד:** פותחים פרויקט ב-Firebase ומוסיפים אפליקציית Android עם אותו שם. מורידים את `google-services.json` לתיקייה `client/android/app/`. בשרת ממלאים את `FIREBASE_SERVICE_ACCOUNT` (מפתח Service account, בשורה אחת).
  חשוב: בלי `google-services.json` אסור לבנות גרסה אמיתית (לא הדגמה), כי האפליקציה תקרוס כשתבקש הרשאה להתראות.
- בלי המפתחות האלה השרת רק רושם בלוג שהייתה שולחת התראה.

## בנייה והעלאה

```bash
cd client
npm run app:sync        # בונה את האפליקציה עם כתובת השרת ומעדכן את שני הפרויקטים
npm run android:open    # Android Studio → Build → Generate Signed Bundle (AAB) → Play Console
npm run ios:open        # Xcode (על Mac) → Product → Archive → Distribute → TestFlight / App Store
npm run app:assets      # אחרי החלפת לוגו ב-client/resources: מייצר מחדש אייקונים ומסך פתיחה
```

## אייפון בלי Mac: בנייה בענן ל-TestFlight

התהליך **iPhone → TestFlight** בגיטהאב בונה את האפליקציה על מחשב Mac בענן, חותם אותה ומעלה ל-App Store Connect. החתימה אוטומטית: Xcode יוצר ומחדש את התעודות בעצמו בעזרת מפתח API.

**הכנה חד-פעמית:**
1. **חשבון Apple Developer** (ארגון, על שם החברה) מאושר.
2. **רישום שם האפליקציה:** ב-developer.apple.com ← Certificates, Identifiers & Profiles ← Identifiers ← ‎+‎ ← App IDs ← App.
   Bundle ID (Explicit): `il.co.noaavital.creatorclub`. מסמנים **Push Notifications** ו-**Associated Domains**.
3. **יצירת האפליקציה בחנות:** ב-appstoreconnect.apple.com ← Apps ← ‎+‎ ← New App. פלטפורמה iOS, שם "Creator Club" (או שם אחר שפנוי בחנות), שפה עברית, ה-Bundle ID מסעיף 2, ו-SKU כלשהו (למשל `creatorclub`).
4. **מפתח API:** ב-App Store Connect ← Users and Access ← Integrations ← App Store Connect API ← Team Keys ← ‎+‎. שם: `GitHub`, תפקיד **Admin**.
   מורידים את קובץ ה-‎.p8 (אפשר להוריד רק פעם אחת) ורושמים את ה-**Key ID** ואת ה-**Issuer ID** שמופיע מעל הטבלה.
   בפעם הראשונה, בעל החשבון (Account Holder) צריך ללחוץ שם על Request Access.
5. **ה-Team ID:** ב-developer.apple.com ← Account ← Membership details. 10 תווים.
6. **סודות בגיטהאב:** ב-repo ← Settings ← Secrets and variables ← Actions ← New repository secret. מוסיפים ארבעה:

| שם | ערך |
|---|---|
| `APPLE_TEAM_ID` | ה-Team ID |
| `ASC_KEY_ID` | ה-Key ID |
| `ASC_ISSUER_ID` | ה-Issuer ID |
| `ASC_KEY_P8` | כל התוכן של קובץ ה-‎.p8 (פותחים ב-Notepad ומעתיקים הכול, כולל שורות BEGIN/END) |

**הרצה:** גיטהאב ← Actions ← **iPhone → TestFlight** ← Run workflow. מקלידים מספר גרסה (למשל `1.0`), ומספר ה-build עולה לבד בכל הרצה.
אחרי 10 עד 30 דקות הגרסה מופיעה ב-App Store Connect ← TestFlight. משם מוסיפים בודקים (עד 100 במייל) ומתקינים דרך אפליקציית TestFlight באייפון.

אחרי שיש Team ID מחליפים את `APPLE_TEAM_ID` בקובץ `client/public/.well-known/apple-app-site-association`, כדי שקישורי קמפיינים מווטסאפ ייפתחו באפליקציה.

### מה החנויות ידרשו
- מדיניות פרטיות: קישור לעמוד באתר.
- צילומי מסך: 6.7 אינץ' לאייפון, וטלפון לאנדרואיד.
- חשבון לבודקים: Apple בודקת אפליקציות עם כניסה. צריך לתת להם מייל וסיסמה של יוצרת לדוגמה במצב "פעילה".
- מחיקת חשבון: Apple דורשת שאפשר יהיה למחוק את החשבון מתוך האפליקציה. קיים: פרופיל ← מחיקת החשבון.
