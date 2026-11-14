# GE Studios — Calm Motion and One Surface Design (draft)

## Purpose
Make Grand Element feel restful, direct, and easy to navigate. The screen is a **single changing workspace** rather than a stack of bordered windows. The music player, if actively playing, must not be torn down when listeners switch Albums, Songs or Playlists. This motion lab is an isolated preview, not a replacement for the protected Radio or DJ controller.

## Visual motion options
| Option | Transition | Default behavior |
| --- | --- | --- |
| Soft Fade (recommended) | 170 ms | Opacity only |
| Gentle Float | 225 ms | Opacity plus 6 px vertical settling |
| Dreamy | 260 ms | Opacity, 3 px settling and 0.992 scale |
| None | 0 ms | No movement |
| Ambient glow (opt-in) | 12-second breathing cycle | Very low-opacity decorative layer, independently stoppable |

The lab lets the user compare these styles and switch between compact spacing (3–6 px) and more breathing room. No rapid flashing, spinning, parallax, foreground blur, or continuous motion forced on users. Minimize performance cost by animating opacity and transform. The experimental `Document.startViewTransition` path uses a supported-browser check, and the standard DOM path is the fallback.

## One-surface interaction contract
1. Album cover opens the same content area, not a nested overlay. Use the actual covers in `ge-images/images/Grand Element - [Album].jpg`.
2. Tabs replace the center content only, with persistent transport and current song. Preserve playback, queue, repeat state, selected songs, scroll, authenticated access, and progress.
3. A selected song can play and repeat individually. A selected list can be played or reordered, shared using a short permanent URL (future separate integration), and purchased only after real provider-backed checkout is verified.
4. Public music catalog is read from approved GitHub source files. The private Fan Base Vault is the records source. Don't create another competing playlist master.
5. Controls must have a single name, action, and visual style across the site, with keyboard focus and large click targets. Use less framing and a single clear navigation layer.

## Accessibility / comfort
- Browser zoom remains available; test on 320 px mobile widths and at 200% zoom.
- Follow OS `prefers-reduced-motion`, and always offer an explicit **None** option.
- Ambient animation starts off; listeners can enable and stop it.
- Avoid scroll-jacking, strobing, motion-induced nausea or attention-demanding loops. Maintain keyboard and screen-reader focus after transitions.
- Keep site responsive without JS-only layouts. Never let an animated transition delay tapping Play.
- Respect slower devices, battery use and low bandwidth. Do not use continuous canvas/WebGL or heavy filters as baseline behavior.

## Safe rollout
This is a feature branch and a design preview only. Do not merge directly into the live Radio, Gate, music V5/V7 or Back Room while the existing main-branch workflows are red. First resolve blockers in QA, verify music queue and Vault boundaries, then enable the motion primitive progressively on the actual listener view. Use real-device tests for iPhone Safari, Android Chrome, desktop keyboard, iPad/tablet rotation and reduced-motion.

## References
- [MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [W3C WCAG 2.2 Understanding Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)
- [W3C C39 reduced-motion media query](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)
- [web.dev Animation and performance](https://web.dev/articles/animations-and-performance)
