# Look brief: "Duolingo made a train piano tiles"

Researched 2026-11-21. A reference is a feel to match, never parts to copy. No Duolingo assets, mascot, colours-as-brand or name anywhere in our app.

## Read this first: how solid the sources are

- Duolingo's own design site (design.duolingo.com) **redirects every page to its blog hub today** (HTTP 301, checked 2026-11-21 on color, typography, motion, illustration and writing). I could not read it directly. Its hex values below come from the search-result snippet of its colour page, from Canny Creative and BrandPalettes (brand write-ups), and from two third-party reconstructions. Each rule says which.
- **Stated** = a named source says it. **Inference** = mine, from the feel of the app and general craft. Anything marked Reconstructed is a designer's CSS guess, not Duolingo's shipping code.
- No source gave real motion timings from Duolingo. Durations here are a reconstruction plus my inference. Treat them as starting values to tune by eye.

## Rules a builder can apply today

### 1. Colour

- **Core green is the brand.** Feather Green `#58CC02`; Mask Green `#89E219` as the brighter partner; Eel `#4B4B4B` for text instead of black; Snow `#FFFFFF` as the main background. Guidance: "when in doubt, lean in to green". Source: [Canny Creative](https://www.canny-creative.com/brand-breakdown/brand/duolingo/), [BrandPalettes](https://brandpalettes.com/duolingo-colors/) (both about the 2019 palette).
- **Secondary brights** (animal names): Macaw blue `#1CB0F6`, Cardinal red `#FF4B4B`, Bee yellow `#FFC800`, Fox orange `#FF9600`, Beetle purple `#CE82FF`, Humpback blue `#2B70C9`. Macaw, Cardinal, Bee, Fox and Humpback appear in the snippet of the official colour page ([design.duolingo.com/identity/color](https://design.duolingo.com/identity/color), now redirected); Beetle's hex is from [shadcn.io DESIGN.md](https://www.shadcn.io/design/duolingo/raw) (third party, 2026-05-13).
- **Neutrals** (third party, from the site's CSS): hairline `#E5E5E5`, hover surface `#F7F7F7`, body `#3C3C3C` and `#4B4B4B`, muted `#777777`, disabled and quiet `#AFAFAF`. Source: [shadcn.io](https://www.shadcn.io/design/duolingo/raw).
- **State by colour** (third party, same page): green fill is the action; its darker `#58A700` is pressed and is the bottom edge; soft green `#D7FFB8` tints a correct or selected item; red `#FF4B4B` is error; blue `#1CB0F6` is the focused or secondary control (2px blue border on focus); `#AFAFAF` is disabled; gold `#FFC800` is a reward; orange `#FF9600` is a streak. Each colour has one job. Also [Blake Crosley's guide](https://blakecrosley.com/guides/design/duolingo) (Reconstructed) gives the same job split.
- **White space:** white is the primary background across app and website ([Canny](https://www.canny-creative.com/brand-breakdown/brand/duolingo/)). No source gives a percentage. Inference: the screen is mostly empty white with one coloured thing that matters, and the page shows "no borders or background elements around sections" in some designs, using whitespace instead of boxes ([Duolingo blog, core tabs](https://blog.duolingo.com/core-tabs-redesign/)).
- **Rule for us:** light ground, one hero colour, colour means one thing, no gradients on surfaces, no glow.

### 2. Shape

- **Chunky button:** fill, a solid darker bottom edge 4px tall, radius 16px, label in 700 weight uppercase with 0.8px tracking. On press the edge collapses and the button drops 4px. Sources: [shadcn.io](https://www.shadcn.io/design/duolingo/raw) (3 to 4px lip, 16px radius, 50px height) and [Blake Crosley](https://blakecrosley.com/guides/design/duolingo) (Reconstructed: `border-bottom: 4px solid #58a700`, `border-radius: 16px`, `padding: 14px 24px`, press = border-bottom 0 plus 4px shift).
- **Secondary button:** white fill, 2px `#AFAFAF` border, blue label, same 16px radius, 50px tall. Source: [shadcn.io](https://www.shadcn.io/design/duolingo/raw).
- **Inputs:** 2px `#E5E5E5` border, 8px radius, 48px tall; focus 2px `#1CB0F6`. Chips 8px, pill badges fully round. Source: [shadcn.io](https://www.shadcn.io/design/duolingo/raw).
- **Progress bar:** track 16px tall, 8px radius, `#E5E5E5`; fill green, 8px radius. Source: [Blake Crosley](https://blakecrosley.com/guides/design/duolingo) (Reconstructed).
- **Cards:** the team uses "soft rounded cards" to separate blocks in one direction and whitespace alone in another, and shipped the whitespace version ([Duolingo blog](https://blog.duolingo.com/core-tabs-redesign/)). Inference: where a card is needed, 2px light-grey border, no shadow, 16px radius.
- **Rule for us:** one radius family (8, 16, full), 2px borders, hard edge instead of a blurred shadow, tap targets 48px or taller.

### 3. Type

- **Stated:** headlines in Feather Bold (custom, lowercase, drawn by Fontsmith with Johnson Banks, shaped from Duo's feathers and eyebrows); body in DIN Next Rounded, sentence case; the two are never mixed in one sentence. Sources: [Johnson Banks, 2019](https://www.johnsonbanks.co.uk/templates/work/duolingo), [Creative Bloq, 2019](https://www.creativebloq.com/news/feather-bold), [Canny Creative](https://www.canny-creative.com/brand-breakdown/brand/duolingo/). One third-party page says the UI face is "DIN Round", so the exact UI font name is not confirmed.
- **Sizes** (third party, marketing site): display 48 and 64px at 700; heading 32px 700; body 17px 500; labels 15px 700 uppercase with 0.8px tracking; caption 13px 500. Source: [shadcn.io](https://www.shadcn.io/design/duolingo/raw).
- **Both Duolingo fonts are paid or custom. We may not ship them.**
- **Free choice, my inference: Nunito** (Google Fonts, SIL Open Font License, variable 200 to 1000). Why: rounded terminals like DIN Next Rounded, friendly but not babyish, a real 800 and 900 weight that stands in for the chunky headline, and one family covers display and body. Run it at 800 for headlines and 700 for buttons. Ship it as a local woff2, like Bricolage is shipped today. Fallback `system-ui`.

### 4. Motion

- **Stated principles** (Duolingo design studio post, via LinkedIn snippet, no timings): make people feel something; find a rhythm, every animation has a "beat". Also: each character has its own animation for a correct answer, and mid-lesson animations reward streaks ([Duolingo blog, building character](https://blog.duolingo.com/building-character/)).
- **Durations (Reconstructed, [Blake Crosley](https://blakecrosley.com/guides/design/duolingo), not Duolingo's code):** button press filter 100ms; feedback bar slides up 200ms ease-out; progress fill 300ms ease-out; idle flame loops 2s ease-in-out, scale to 1.05, rotate 2deg; urgent flame 0.8s.
- **Bounce and squash:** I found no Duolingo source for exact squash numbers. Inference: a scale pop with a little overshoot, and a squash on landing (wide and short for a beat, then back). A generic recipe elsewhere uses scale X 1.2 with Y 0.8 ([skills.sh Rive guide](https://skills.sh/dylantarre/animation-principles/rive-animations), not Duolingo). Keep ours milder, about 1.08 and 0.92.
- **Sound** (third party, no specs): a bright celebratory chime for correct, a soft descending tone for wrong, never harsh. Sources: [Soundcy](https://soundcy.com/article/what-does-duolingo-sound-like), [Out of Scope](https://out-of-scope-product.beehiiv.com/p/duolingo-has-it-venmo-has-it-even-slack-has-it-your-product-doesn-t).
- **Celebration moments (Reconstructed):** correct answer banner with sound, lesson complete, streak milestone, chests and XP. Source: [Blake Crosley](https://blakecrosley.com/guides/design/duolingo).

### 5. Illustration and character

- **Stated:** Duo is "very geometric and basically just a body with wings", "constructed very simply", with big eyes, a distinctive body shape and detached feet; the supporting characters are built from the same basic shapes so they match; they have "very quirky personalities". Duo took about 18 months to design. Source: [Duolingo blog, building character](https://blog.duolingo.com/building-character/). The 2019 version is simplified with small details like eye feathering, built to show moods from confusion to delight ([Canny Creative](https://www.canny-creative.com/brand-breakdown/brand/duolingo/)). Quirks like the flick on the g are used "sparingly" ([Johnson Banks](https://www.johnsonbanks.co.uk/templates/work/duolingo)).
- **Palette for illustration:** green, yellow and orange for the beak and feet (`#FFC200`, `#F49000`, `#B66E28`) plus the secondary brights ([BrandPalettes](https://brandpalettes.com/duolingo-colors/), [Canny](https://www.canny-creative.com/brand-breakdown/brand/duolingo/)).
- **Outlines: not confirmed from a source.** Inference from looking at the app: flat fills, no outlines, no gradients, no shading, a tiny set of colours.
- **Why it reads as Duolingo and not a kids' game (inference):** it is mostly white space with one character; the shapes are simple and few; the colours are limited and flat; the copy has dry, grown-up wit. The character reacts to your state, so it feels alive, and a sad character is "charming" where a sad logo would annoy ([Blake Crosley](https://blakecrosley.com/guides/design/duolingo), the author's own opinion).
- **Rule for us:** the train is our character. Flat shapes, big eyes, detached wheels, no outline, three or four colours, a different face for each state (waiting, rolling, arriving, perfect, missed).

### 6. Words

Three examples (the first two from the official Duo voice page snippet, the third from a third-party list):
1. "Way to go, sharpshooter." ([design.duolingo.com/writing/duo](https://design.duolingo.com/writing/duo), snippet; page now redirected)
2. "Maybe try that one again." (same page)
3. "Complete a lesson to extend your streak!" ([Blake Crosley](https://blakecrosley.com/guides/design/duolingo), Reconstructed)

- Stated: the voice stays the same and the tone adapts to the learner's state of mind ([design.duolingo.com/writing/tone](https://design.duolingo.com/writing/tone), snippet). The brand is "expressive, playful, embracing and worldly" ([Canny Creative](https://www.canny-creative.com/brand-breakdown/brand/duolingo/)).
- Rule for us (inference): the button says what happens, in two or three words, in the imperative. A miss is gentle and has a next step. A hit is specific. Never scold, never shout.

### 7. What reads as "Roblox-like" or cheap, and what to remove

The sources I found do not name neon, glow or heavy outlines directly. What they do say is clutter and information overload are the most common HUD mistakes ([UX Collective, 7 beginner HUD mistakes](https://bootcamp.uxdesign.cc/7-obvious-beginner-mistakes-with-your-games-hud-from-a-ui-ux-art-director-d852e255184a)), and that when many panels compete you should pick one primary style and make the rest quieter. The rest of this list is **my inference**:

- Remove near-black backgrounds with neon fills. Light ground, flat colour.
- Remove glow, outer shadows, text shadows, inner bevels and gradient fills.
- Remove thick dark outlines around shapes and text.
- Remove many pills, labels, stat chips and panels on one screen. One question per screen, one big button.
- Remove all-caps tiny captions in grey on dark. Keep uppercase only on button labels.
- Remove more than one accent hue competing for attention. One hero colour and the line colours, each with one job.
- Remove mixed icon styles and emoji as icons. One flat icon set.
- Remove random bouncing and looping glints. Motion happens because the player did something.

## For our app

### Palette (ours, not Duolingo's)

Hero is a bright violet. It is far from every MBTA line colour and from Duolingo's green. Alternatives are Nicolo's call.

| Role | Hex | Edge (the 4px bottom) | Use |
|---|---|---|---|
| Hero, "Signal" | `#6B4EFF` | `#4A33CC` | Primary button, the one thing to do next |
| Hero tint | `#ECE8FF` | | Selected card, soft highlight |
| Ground | `#FFFFFF` | | Page |
| Mist | `#F6F7FB` | | Alternate band, hover |
| Line | `#E3E6EF` | | Borders, tracks |
| Ink | `#1F2430` | | Text |
| Ink 2 | `#5A6275` | | Secondary text |
| Ink 3 | `#8D94A5` | | Disabled only, never needed text |
| Hit | `#19B96B` | `#118A4F` | Correct, perfect |
| Hit tint | `#DDF8EA` | | Hit banner |
| Miss | `#FF5C5C` | `#D93C3C` | Missed, error |
| Gold | `#FFC83D` | `#D99A00` | Score, reward |

- White text on the hero is about 5:1 (my calculation, check it with a tool before shipping).
- Seat colours stay the four already in `tokens.css` (`#29D6FF`, `#FF4FA3`, `#FFD43B`, `#7CFF6B`). On a light ground the lime and yellow are weak, so give each seat a darker edge and put the seat number in white or ink on it.
- **The eight MBTA line colours stay, for the small dot that names a line only.** `tokens.css` holds Red `#DA291C`, Orange `#ED8B00`, Blue `#003DA5`, Green `#00843D` and Mattapan (same red) from the MBTA's API. I did not confirm the other line colours; from memory they are Silver `#7C878E`, Commuter Rail `#80276C` and Ferry `#008EAA`. Check them against the MBTA API before use. Note Hit green is not Green Line green: use Hit only for feedback.
- **Floor caveat (inference):** a projector adds light, so a white floor display is a flood of light over the whole platform and can wash out in a lit station. Apply shape, type, motion and word rules to the floor as they are, but test the ground colour on the real floor. The light ground rule is firm for the phone.

### Type

Nunito, local woff2, 800 for headlines and numbers, 700 for buttons and labels, 600 for body. Scale stays the fixed one in `tokens.css` (13, 15, 17, 22, 28, 40, 72). Sentence case everywhere, uppercase on button labels only with 0.06em tracking.

### Button recipe (CSS)

Hard edge from a zero-blur `box-shadow`, so the press does not shift the layout.

```css
.btn {
  --face: var(--hero, #6B4EFF);
  --edge: var(--hero-edge, #4A33CC);
  min-height: 3rem;
  padding: 0.875rem 1.5rem;
  border: 0;
  border-radius: 1rem;
  background: var(--face);
  color: #fff;
  font: 800 1.0625rem/1 "Nunito", system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow: 0 4px 0 var(--edge);
  transition: transform 100ms ease-out, box-shadow 100ms ease-out;
}
.btn:active { transform: translateY(4px); box-shadow: 0 0 0 var(--edge); }
.btn:focus-visible { outline: 3px solid var(--hero-tint, #ECE8FF); outline-offset: 3px; }
.btn:disabled { --face: #E3E6EF; --edge: #C7CBD8; color: #8D94A5; box-shadow: 0 4px 0 var(--edge); }
.btn.hit  { --face: #19B96B; --edge: #118A4F; }
.btn.miss { --face: #FF5C5C; --edge: #D93C3C; }
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
```

The secondary button: white face, 2px `#E3E6EF` border, hero-coloured label, edge `#E3E6EF`.

### Five motion rules

1. **A press is physical.** 100ms, drops 4px, the edge closes. Nothing else on the screen moves for a press.
2. **Feedback arrives from the bottom edge.** The hit or miss bar slides up in 200ms ease-out, with its word, colour and sound at the same instant.
3. **Fills and scores count up.** 300ms ease-out for any bar or number that changes.
4. **A hit pops, a miss shrugs.** Hit: scale 1 to 1.08 to 1 in about 220ms with a small overshoot (`cubic-bezier(.34,1.56,.64,1)`), then the squash: 1.08 wide by 0.92 tall for one frame. Miss: a short 2px side-to-side wobble, no red flash, softer tone.
5. **Celebrate once, then rest.** A big moment (perfect, arrival) lasts 1.2s or less, then the screen goes still. Idle loops are slow (2s) and small (5% scale). Everything honours `prefers-reduced-motion`.

Sound pairs with every state: a bright chime for a hit, a soft descending tone for a miss, a short low "chug" for the train.

## Before a builder starts

- Screenshot the real screen next to the Duolingo lesson screen, from a phone-sized view, and check it is lighter, emptier and flatter than the current one.
- Count the colours on one screen: ground, ink, one hero, and one state colour at most.
- Do not use the name, owl, the green `#58CC02`, or the Feather typeface.
