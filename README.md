# FinanzGame

Ein Browserspiel für die Oberstufe. Lernende spielen einen Monat (28 Tage) und wählen jeden Tag, was sie in ihrer freien Zeit machen. Ziel ist, fünf Werte möglichst hoch und im Gleichgewicht zu halten: **Geld, Zufriedenheit, Wertstiftung, Energie und Beziehungen**.

Kernidee: Geld ist oft die Folge von Nutzen, den man für andere schafft. Wer nur auf einen Wert setzt, verliert Punkte.

- Läuft im Browser, optimiert für iPads im Querformat, funktioniert auch im Hochformat und am Laptop
- Kein Login. Spielstand, Reflexionen und Durchgänge bleiben im Browser des Geräts
- Optionale gemeinsame Bestenliste über ein Google Sheet
- Editor für Lehrpersonen: Werte, Aktivitäten, Ereignisse und Fragen anpassen und als Link teilen

## So läuft ein Spiel

1. Spitzname eingeben (kein echter Name)
2. Jeden Tag: an Schultagen Nachmittag und Abend wählen, am Wochenende zusätzlich den Morgen
3. Die gestrichelte Linie im Fünfeck zeigt, wie sich die Werte nach dem Tag verändern
4. Etwa an jedem zweiten Tag passiert ein Ereignis mit einer Entscheidung
5. Nach jeder Woche: Rückblick mit Verlauf und einer Reflexionsfrage. Hier kann man speichern und später weiterspielen
6. Nach 28 Tagen: Monatsauswertung, druckbar oder als PDF speicherbar, Eintrag in die Bestenliste

**Punkte** = Durchschnitt aller Werte − halber Abstand zwischen höchstem und tiefstem Wert. Für jeden Wert auf 0 gibt es 5 Punkte Abzug.

Testläufe mit der Standard-Variante: Ausgewogenes Spiel erreicht etwa 75–80 Punkte, Spiel nur auf Geld oder nur auf Spass unter 10 Punkte.

## Schritt 1: Spiel online stellen (GitHub Pages)

1. Auf GitHub das Repository öffnen: **Settings → General**. Ganz unten bei «Danger Zone» die Sichtbarkeit auf **Public** stellen (bei einem Gratis-Konto nötig). Im Code sind keine Daten von Lernenden.
2. **Settings → Pages**. Bei «Source» **Deploy from a branch** wählen, dann den Branch (z.B. `main`) und den Ordner `/ (root)`. Speichern.
3. Nach ein bis zwei Minuten steht oben die Adresse, z.B. `https://reneluechinger.github.io/finanzgame/`. Diesen Link bekommen die Lernenden.

## Schritt 2: Bestenliste einrichten (optional)

Ohne diesen Schritt zeigt jedes Gerät nur die eigenen Durchgänge.

1. Neues Google Sheet anlegen, z.B. «FinanzGame Bestenliste».
2. Im Sheet: **Erweiterungen → Apps Script**.
3. Den Inhalt von `apps-script/Code.gs` in das Fenster kopieren (vorhandenen Code ersetzen) und speichern.
4. **Bereitstellen → Neue Bereitstellung**. Beim Zahnrad «Web-App» wählen.
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
5. **Bereitstellen** klicken, Google-Konto autorisieren. Die angezeigte **Web-App-URL** kopieren (endet auf `/exec`).
6. Im Spiel unten auf **Für Lehrpersonen** tippen, PIN eingeben, Reiter **Allgemein**, URL bei «Bestenliste» einfügen, **Speichern**.
7. Reiter **Teilen → Link erzeugen** und diesen Link der Klasse geben. Nur wer den Link öffnet, schreibt in die gemeinsame Liste.

Unpassende Spitznamen löschst du direkt im Sheet (Zeile löschen).

## Schritt 3: Eigene Variante erstellen

1. Im Spiel auf **Für Lehrpersonen** tippen. Die Standard-PIN ist **1234**. Bitte unter **Allgemein → PIN ändern** eine eigene setzen.
2. Anpassen:
   - **Werte**: umbenennen, Symbol und Farbe ändern, neue Werte hinzufügen oder entfernen. Der Geld-Wert bleibt immer.
   - **Aktivitäten**: Wirkung auf jeden Wert, Geld, wann sie möglich sind. Unter «Erweitert» lassen sich Aktivitäten freischalten (Beispiel: Babysitter-Kurs schaltet ab nächster Woche Babysitten frei).
   - **Ereignisse**: Text und bis zu drei Wahlmöglichkeiten
   - **Kosten & Fragen**: laufende Kosten und die vier Reflexionsfragen
3. **Speichern**, dann **Teilen → Link erzeugen**. Jede Variante hat eine eigene Bestenliste.

Hinweis: Änderungen wirken nur auf dem eigenen Gerät, bis du den neuen Link teilst. Der Link enthält die ganze Variante, darum ist er lang. Tipp: als QR-Code oder über die Schulplattform verteilen.

## Datenschutz

- Kein Login, keine Namen, keine E-Mail-Adressen
- Spielstand und Reflexionsantworten bleiben auf dem Gerät. Wird der Browserverlauf gelöscht, sind sie weg
- In die Bestenliste gehen nur Spitzname, Punkte, Datum, Variante und Endwerte
- Die PIN schützt den Editor vor Neugier, sie ist kein Sicherheitsmerkmal

## Für Entwicklerinnen und Entwickler

Reines HTML, CSS und JavaScript (ES-Module), keine Abhängigkeiten, kein Build-Schritt.

```
index.html          Einstieg
css/style.css       Gestaltung (Design «Balance»)
js/config.js        Standard-Variante: Werte, Aktivitäten, Ereignisse, Zahlen
js/engine.js        Spiellogik ohne Oberfläche
js/app.js           Bildschirme und Bedienung
js/editor.js        Editor für Lehrpersonen
js/charts.js        Fünfeck und Verlaufsdiagramm (SVG)
js/storage.js       localStorage, Link-Codierung, Prüfung von Varianten
js/leaderboard.js   Bestenliste (Apps Script oder lokal)
apps-script/Code.gs Google-Apps-Script für die Bestenliste
tests/              Tests der Spiellogik und Simulation zum Abstimmen
```

Lokal starten: `python3 -m http.server` im Projektordner, dann `http://localhost:8000` öffnen (ES-Module laufen nicht über `file://`).

Tests: `node --test tests/engine.test.mjs`
Abstimmung der Zahlen: `node tests/sim.mjs` spielt vier Strategien je 30-mal durch.
