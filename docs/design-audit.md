# Linden design audit — 2026-09-17

Scope: original Figma screens 300:6525–300:6528 and the subsequently requested full-screen dictation flow. No Figma nodes were modified.

## Evidence and limits

Read live Figma design context and screenshots for login/home; inspected visible effects across all four source instances through the Plugin API. Compared against local CSS, animation wrappers and original SVG exports. Original instance dimensions are 338.46155 × 720, uniformly scaled in the application.

This is a source/structure audit, not a completed browser screenshot comparison. Browser preview could not be prepared from the available static project/dependency cache; attempted preview setup files were removed. No live browser screenshot or physical-device test was obtained. Do not call this implementation pixel-perfect verified.

## Findings

| Area | Evidence | Result |
| --- | --- | --- |
| Login and home background | Figma wallpaper BACKGROUND_BLUR radius 129.969223; generated CSS at normalized size 73.92; actual instance CSS sigma 64.9846115. Values were correct, but blur was carried by a separate backdrop layer while artwork was unfiltered. | Applied the same sigma directly to the artwork, preserving positions and colors. Removed backdrop blur from tint layer to avoid double blur. Needs rendered comparison. |
| Home card glass during entrance | Parent animation used opacity 0–1 and filter blur(3px)–blur(0px). These establish backdrop roots, preventing descendant backdrop filters from sampling outside the animated parent. | Kept grouped card motion, translation, scale and timing; removed parent opacity/filter animation. Glass can sample the background during entrance. |
| Safari support on added surfaces | New voice panel and full-screen conversation bar had only unprefixed backdrop-filter. Original cards/bar already included both properties. | Added -webkit-backdrop-filter with the same values, including dialog backdrop. |
| Avatar shadows and glow | Exported SVGs contain feGaussianBlur: large shadow 25.5744; avatar 19.021, 10.8691, 8.15185; small avatars 12.7872, 9.51049, 5.43457, 4.07592, with inner shadow filters. | Present. No duplicate CSS blur added. |
| Bottom-bar color glow | Original SVG sigma: green 22.8571, coral 7.03297, yellow 14.0659, ring 1.75824. | Present. No duplicate CSS blur added. |
| Original glass cards | Figma GLASS radius 1.739061, refraction .8, depth 15.651548, light angle -45°, intensity .8. CSS uses blur .86953 plus translucent surfaces and highlights. | Approximation remains: CSS blur does not reproduce Figma's physical refraction/depth. Requires visual review and a separate rendering decision for exact parity. |
| Original buttons | Inner shadow radius 10.830769, offset 0/-4.51282, black .2. Top controls drop shadow radius 14.441026, offset 0/7.220513, spread 3.610256, black .1. | Values match CSS definitions. Raster appearance not verified. |
| Original onboarding | Sheet top 49.230774; radius 28.131868; fill #f6f5f4; shadow 0/-31.648352/28.131868, rgba(71,55,47,.2). | Values match CSS definitions. |
| Typography | Original labels are outlined Figma SVGs. Added voice/dictation text uses Arial; source reference uses Noto Sans. | Original labels retained; new dynamic text is not an exact typography match. Font sourcing still pending. |
| Full-screen voice background | New concept requested after Figma replication; radial colors with CSS blur 32px and microphone-driven movement. | Present by design, visible while listening. Not an omitted blur in the static Figma screen. |

## Remaining verification

Compare rendered login/home/assistant/onboarding at the same viewport and motion time. Check Chrome and Safari, the entry transition and stationary cards. Review full-screen voice at silence and active volume. Confirm edge softness around the phone clip, glass refraction, dynamic typography and 200% text scaling. Keep intentional new voice navigation separate from original-design discrepancies.

Reference for backdrop-root behavior: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter#backdrop_root
