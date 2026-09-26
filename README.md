# SPS Scroll World

Een statische webapp voor het SPS-handboek. De app werkt zonder build-stap en kan direct via GitHub Pages worden gepubliceerd.

## Lokaal bekijken

Start vanuit deze map een eenvoudige server:

```bash
python3 -m http.server 8765
```

Open daarna:

```text
http://127.0.0.1:8765/
```

## Publiceren via GitHub Pages

1. Maak een nieuwe GitHub-repository aan.
2. Upload de inhoud van deze map (`index.html`, `style.css`, `app.js`, `assets/`, `README.md`, `.nojekyll`).
3. Ga in GitHub naar `Settings` -> `Pages`.
4. Kies `Deploy from a branch`.
5. Kies branch `main` en folder `/ (root)`.
6. Sla op. GitHub toont daarna de publieke URL van de webapp.

## Structuur

- `index.html` - app-shell en inhoudssecties.
- `style.css` - volledige layout, klei-matte visuals en responsive styling.
- `app.js` - zoeken, filters, detailvenster en visuele kaarten.
- `assets/sps-data.js` - lokale handboekdata.

## Let op

De app bevat medische protocolinformatie uit het aangeleverde handboek. Controleer inhoudelijke wijzigingen altijd tegen de actuele bronversie voordat je de app breder deelt.
