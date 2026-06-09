# HPSA Dental Health Interactive Map

This is a no-build static site for GitHub Pages. It renders an interactive
Dental Health HPSA map using:

- `index.html`
- `styles.css`
- `map.js`
- `state-counts.json`

The page loads D3, TopoJSON, and US Atlas from jsDelivr to draw real US state
boundaries. If those libraries or the map geometry fail to load, `map.js`
falls back to a built-in SVG state tile map.

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload these files to the repository root, or place them in `/docs`.
3. In GitHub, open Settings -> Pages.
4. Choose the branch and folder that contain `index.html`.
5. Wait for GitHub Pages to publish the site.

Your URL will look like:

```html
https://USERNAME.github.io/REPOSITORY/
```

## Canvas iframe embed

Replace the URL below with your GitHub Pages URL:

```html
<iframe
  src="https://USERNAME.github.io/REPOSITORY/"
  width="100%"
  height="780"
  style="border:0;"
  loading="lazy"
  allowfullscreen>
</iframe>
```

## Data notes

Counts are unique `HPSA ID` values from `BCD_HPSA_FCT_DET_DH.csv`, filtered to
`HPSA Status = Designated`.

Categories:

- Facilities: Rural Health Clinic, Federally Qualified Health Center, FQHC
  Look A Like, Indian Health Service/Tribal/Urban Indian Health Organizations,
  Correctional Facility, Other Facility
- Geographic areas: Geographic HPSA, High Needs Geographic HPSA
- Population groups: HPSA Population
