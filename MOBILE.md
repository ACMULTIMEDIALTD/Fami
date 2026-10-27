# האפליקציה לאייפון ולאנדרואיד

אותה אפליקציה (React) רצה בשלוש צורות:

| | מה זה | מה צריך |
|---|---|---|
| **אתר שאפשר להתקין (PWA)** | יוצרת פותחת את הקישור מהווטסאפ ומוסיפה למסך הבית. מקבלת אייקון ומסך מלא. | כלום. עובד ברגע שהאתר באוויר. |
| **אפליקציית אנדרואיד** | `client/android`, פרויקט Android Studio | חשבון Google Play Console ($25, תשלום חד־פעמי) |
| **אפליקציית אייפון** | `client/ios`, פרויקט Xcode | חשבון Apple Developer ($99 לשנה) ומחשב Mac עם Xcode (או שירות בנייה בענן) |

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

בלי Mac: שירותים כמו Codemagic או Ionic Appflow בונים וחותמים את גרסת האייפון בענן, מתוך ה-repo הזה.

### מה החנויות ידרשו
- מדיניות פרטיות: קישור לעמוד באתר.
- צילומי מסך: 6.7 אינץ' לאייפון, וטלפון לאנדרואיד.
- חשבון לבודקים: Apple בודקת אפליקציות עם כניסה. צריך לתת להם מייל וסיסמה של יוצרת לדוגמה במצב "פעילה".
- מחיקת חשבון: Apple דורשת שאפשר יהיה לבקש מחיקת חשבון מתוך האפליקציה. זה עוד לא קיים, וצריך להוסיף לפני ההגשה.
