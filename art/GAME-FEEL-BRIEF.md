# Game feel brief

Written 2026-11-21. Rules a builder can apply today. Every rule has a source link. Anything marked **(inference)** is my own reasoning, not a source.

Source quality warning: I found almost no developer talks or postmortems. Most numbers about Piano Tiles 2, Magic Tiles 3, Beatstar and Just Dance come from fan wikis, store listings and reviews. Where a source was thin I say so. Exact timings for juice effects are rare; the ones here are the only ones I could confirm.

---

## 1. Piano Tiles, Piano Tiles 2, Magic Tiles 3

What the sources confirm:

- **Tiles are black bars on white; tap black, never white.** One wrong tap ends the round. [How-to-play article](https://magictiles-org.pages.dev/blog/how-to-play-piano-tiles-here) (undated).
- **Sound is the reward.** Tapping a black tile plays a piano note; a white tile plays an off-tune note that ends the game. [Red Dot award page for Piano Tiles 2](https://www.red-dot.org/project/piano-tiles-2-15204), [Wikipedia, Piano Tiles](https://www.Wikipedia.org/wiki/Piano_Tiles).
- **A miss shows you which tile you missed.** The missed tile goes red, with an animation, so the loss is readable. [Flutter clone write-up](https://medium.com/flutter-community/ui-challenge-piano-tiles-in-flutter-19bc56139fda). (The clone author says the original does this.)
- **First tap starts the game.** The clone starts the animation on the first tap, not on screen load. Same link.
- **Speed ramps as you play.** "At 5 of 50, the pace already felt more serious." [How-to-play article](https://magictiles-org.pages.dev/blog/how-to-play-piano-tiles-here). In Piano Tiles 2 a fan-wiki talk page says each star makes the song "exceptionally faster", and that crowns work differently from stars. [Fan wiki talk page](https://piano-tiles.fandom.com/wiki/Talk:Piano_Tiles_2/@comment-35720018-20180614231321). Low reliability. The store listing says Top Challenge mode keeps speed constant, so the ramp is not universal. [App Store listing](https://apps.apple.com/app/1027688889).
- **Piano Tiles 2 added long tiles, combo tiles and an animated background.** Same fan wiki. I could not find a source that describes hold or slide tile visuals in detail.
- **Magic Tiles 3: "Perfect" pops up for well-timed taps; a miss stops the music.** [Google Play listing](https://play.google.com/store/apps/eventdetails/4828305994808023193), [screensdesign showcase](https://screensdesign.com/showcase/magic-tiles-3-piano-game). Star rules were not found.
- **Complaint to avoid:** reviewers say ads gating the third star made finishing feel hollow. [App Store reviews](https://apps.apple.com/app/1027688889). Never gate the result.

Rules:

1. A tile is a big, flat, high-contrast rectangle. One colour, no texture. It is the only thing that carries meaning.
2. The sound of a hit is the main reward. Hit plays the song's note; a miss plays something clearly wrong.
3. On a miss, mark the exact tile that was missed. Do not just say "Miss".
4. Ramp speed in visible steps tied to song sections, not a smooth creep. **(inference from the star-speeds claim; low-reliability source)**
5. Long tiles are taller versions of the same tile with a fill that shows they are being held. **(inference; no source detail)**

---

## 2. Beatstar, Guitar Hero, DDR, Just Dance

### Timing words and combo

- **DDR ladder:** Marvelous, Perfect, Great, Good, Almost/Boo, Miss. Combo is "the number of consecutive non-combo breaking judgments." Since DDR 2013, Good no longer breaks combo. [RemyWiki DDR Glossary](https://remywiki.com/DDR_Glossary).
- **DDR windows disagree between sources.** One Japanese tuning page lists about plus or minus 0.0225 s Marvelous, 0.045 s Perfect, 0.09 s Great for one version family; a blog says Marvelous is 16.7 ms each way. [atwiki page](https://w.atwiki.jp/iamkenzen/pages/203.html), [Rocopltx DDR blog](https://buttondown.com/rocopltx/archive/sept-10th-and-17th-2023-ddr-a3-score-reports). Treat numbers as version specific.
- **Beatstar:** three tracks. Perfect+ is a hit in the middle of the "PERFECT" bar. A Great resets the streak. The game "only punishes less-than-perfect hits", and Great is not framed negatively. [Naavik, Beatstar deep dive](https://naavik.co/deep-dives/beatstar-west-finds-rhythm/).
- **Beatstar notes:** mostly single taps, plus holds, four-direction swipes, and rare hold-swipes. Same Naavik link. Swipe holds are the community's most disliked note, because Perfect+ timing feels odd. [TV Tropes, Beatstar](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/Beatstar).
- **Just Dance:** feedback ladder Miss, OK, Good, (Super), Perfect. A streak ("On Fire") multiplies score. In 2023 it moved the streak start from Good up to Super. [Ubisoft, new scoring](https://ubisoft.com/en-au/game/just-dance/2023/news-updates/6JSYL277Jds6As65yqtAvr/new-era-new-scoring). Gold Moves change the pictogram and the sound, and are worth about five Perfects. [Just Dance wiki, Gold Move](https://justdance.fandom.com/wiki/Gold_Move) (fan wiki).
- **Guitar Hero:** a streak raises a score multiplier; Star Power doubles it; a Rock Meter at bottom right ends the song if it drops too low. Results give 3 to 5 stars. [Wikipedia, Guitar Hero](https://en.wikipedia.org/wiki/Guitar_Hero_(video_game)).

### Lane and hit line

- **Guitar Hero:** a scrolling "fret board" with the marked hit area at the bottom; note colour matches the button. Same Wikipedia link.
- **DDR:** four grey arrows form the "Step Zone" at one edge. Falling arrows overlap them to be judged. [RemyWiki DDR Glossary](https://remywiki.com/DDR_Glossary).
- **DDR foot game:** one arrow shape per panel. A **Jump** is two arrows at once (both feet). A **Freeze Arrow** is a long green arrow held for its full length; releasing early gives N.G. and breaks combo. **Shock Arrows** (do not step) come in full rows. Same glossary.
- **DDR arrow colour by rhythm:** red for quarter notes, blue for eighths, yellow for sixteenths, green for the rest. [RemyWiki Groove Radar](https://remywiki.com/GROOVE_RADAR), [StepMania noteskins](https://github.com/stepmania/stepmania/wiki/Noteskins).

### Keeping feedback out of the notes' way

- Every input gets a sound and a visible change, and cues need look-ahead. Judgments ("Miss/Good/Perfect") help players self-correct. [CMU ETC rhythm game lessons, 2019](https://project-archives.etc.cmu.edu/2019/fall/jam-session/index.php/2019/12/06/innovative-and-engaging-rhythm-games).
- Where exactly judgment text sits in each game I could not confirm from a source. The DDR step zone keeps text away from incoming arrows by position; **(inference)** only.

Rules:

6. Draw the hit line as one thick bar across the lane. The tile touching it is the moment.
7. Two foot lanes means one fixed colour per foot, for the lane, the tile and the feedback. Never rely on colour alone. Add shape (left and right markers).
8. Use three words: Perfect, Great, Miss. Put the word on the hit line, not on the tile path, and fade it out fast. **(inference on size and placement)**
9. Combo number lives beside the lane, not in it. Pulse it on each hit and shift its colour at milestones.
10. A long tile (hold) breaks combo if released early, like a DDR Freeze Arrow, and rewards a clean hold.
11. Never punish Great. Beatstar and Just Dance both keep the "close" word positive.

---

## 3. What makes a game feel alive (juice)

Confirmed timings are few:

- **Screen shake: 0.1 to 0.3 seconds**, and "too much shake can overwhelm the player." [itch.io, juicy simple effects](https://itch.io/blog/1059831/making-a-game-feel-juicy-with-simple-effects), [Hackread, The Juice Factor](https://hackread.com/the-juice-factor-designing-game-feel/).
- **Hit pause: 0.2 seconds after a critical hit.** Same itch.io article. Another source: a three-frame freeze after a sword strike. [Hackread](https://hackread.com/the-juice-factor-designing-game-feel/).
- **Squash and stretch:** "a few pixels of scale change" is enough. itch.io article. No percentage in any source.
- **Layer several channels on one event** (visual, sound, motion), and tie juice to the core action. [Game Developer, squeezing more juice](https://gamedeveloper.com/design/squeezing-more-juice-out-of-your-game-design-), [Hackread](https://hackread.com/the-juice-factor-designing-game-feel/).
- **Duolingo:** motion team principles are "make people feel something" and keep a rhythm, so even silent animations have a beat. Milestones are treated like power-ups. Wrong answers get gentle feedback, not red error screens. [Duolingo blog, motion design](https://blog.duolingo.com/streak-milestone-design-animation) and the [search summary of Duolingo posts](https://blog.duolingo.com/how-duolingo-streak-builds-habit). A claim that these animations lifted day-7 retention by 1.7% is unconfirmed. Do not quote it.

Rules:

12. On a hit: tile scales up a few pixels and back (about 0.1 s, **inference on the time**), a ring or burst of particles, the note sounds.
13. On Perfect only: a short flash on the hit line and a brighter particle burst. Great gets less. Miss gets none, only a soft dull sound.
14. Pulse the whole lane or background on each beat by a small amount. **(inference; the beat pulse is standard but I found no timing source)**
15. Combo milestones (10, 25, 50): colour shift, one bigger burst, one extra sound layer. No screen shake on ordinary hits; reserve a 0.1 to 0.3 s shake for milestones or the final hit.
16. Sound layering: add a drum or harmony layer at each combo tier, so the song itself gets fuller. **(inference)**
17. Miss feedback is kind (Duolingo): a wobble, a dull note, no red flash across the screen.

---

## 4. Song-pick and results screens

**Guitar Hero (Wikipedia):** Career is sets of four or five songs; Quick Play picks any unlocked track, then difficulty, character, venue. Results: score and a 3 to 5 star rating. [Wikipedia](https://en.wikipedia.org/wiki/Guitar_Hero_(video_game)).

**Beatstar (Naavik):** a friends leaderboard shows before each song (since November 2021). Auto-cue adds Previous and Next buttons (August 2022). A Daily Shuffle offers three songs from your library. Stars show completion; three medal tiers show extra skill (Diamond needs fewer than 25 non-Perfect+ notes). Left out of what I could confirm: the layout of the results screen itself; Naavik only shows it as an image caption. [Naavik](https://naavik.co/deep-dives/beatstar-west-finds-rhythm/).

Order that appears in both: pick song, (difficulty), play, score plus stars or medal, then next song.

Rules:

18. Results order: big star or crown count first, then team score, then each player's name and Perfect count, then one button for "next song". **(inference; combines the two sources above)**
19. Leave out ads, currency, unlock timers and any gating of the stars. Those are what reviewers hate.

---

## 5. Short onboarding

Confirmed: Piano Tiles starts on the first tap; the rule is one sentence ("tap the black tiles"). [How-to-play article](https://magictiles-org.pages.dev/blog/how-to-play-piano-tiles-here). Naavik does not describe Beatstar's tutorial. I could not confirm how Magic Tiles or Beatstar teach the first tap without text.

Rules (all **inference**, from the one-rule structure of Piano Tiles):

20. The first tile is the only tile, slow, glowing, with a pulsing ring on the hit line.
21. Play the first note's sound the moment it is hit, so the first step teaches "step, hear".
22. No text. Show a ghost foot or a bouncing arrow on the lane for the first tile only.
23. Nothing can fail in the first ten seconds.

---

## 6. Projected and floor games

What the sources confirm:

- **Ambient light washes out projection.** Pick a space with minimal ambient light. [EyeClick floor projector setup](https://eyeclick.com/resources/blog/floor-projector-setup) (vendor guide; checked 2026-11-21).
- **Floor surface:** a light-coloured, smooth, flat, low-gloss floor works best. A dark or carpeted floor needs a large white mat. Same EyeClick guide.
- **Mount distance:** EyeClick says BEAM works best at 8.5 feet, ceiling units at 8 to 12 feet. Same guide.
- **Gap:** EyeClick gives no lumen, contrast or palette advice. I found no BEAM or Lu design guide.
- **Design guidance from child floor-game research:** interaction should be clearly defined and simple, object motion slow and predictable, feedback "clear and discreet." [Springer, co-designed guidelines](https://link.springer.com/content/pdf/10.1007/978-3-662-45212-7_18.pdf) (search summary; I did not open the full paper). The wider floor research says possible interactions are often invisible and confusing to passers-by. [Interact 2015 paper](https://openaccess.city.ac.uk/id/eprint/16607/1/VermeulenLuytenConinxMarquardtBird_interact2015.pdf).
- A floor game that used a bright white tile as the moving target made it easy to see. Same search; an example, not a finding.
- **Not found:** anything about shadows from feet or bodies, or a measured contrast ratio. **Everything below on dim projectors and shadows is inference.**

---

## For our floor and our phone

Ten changes, most valuable first. All for a 720p dim projector floor and a phone remote.

1. **Make every tile near-white or a bright saturated colour on a near-black field, at least a hand's width wide, with a thick bright outline.** A dim projector loses mid-tones; only bright-on-dark survives **(inference; EyeClick confirms ambient light kills the picture)**.
2. **Give each foot a fixed colour and a shape marker (left, right), and keep that colour on the lane, the tile, the hit flash and the phone buttons.** Players must read their foot at a glance; do not rely on colour alone.
3. **Draw one thick hit line across the bottom of each lane, glowing, and flash it on every hit.** Guitar Hero and DDR both read at a glance because the target never moves.
4. **Play the song note on every hit and a dull wrong note on a miss.** Sound is the reward in Piano Tiles; it also works when the floor picture is dim **(partly inference)**.
5. **Show three words only (Perfect, Great, Miss), large on the hit line, fading in about half a second.** Never punish Great. Do not cover the incoming tiles.
6. **On each hit, scale the tile up a few pixels and burst a ring or particles; Perfect gets a brighter burst.** Confirmed effects, no confirmed numbers; use a short 0.1 s pop **(timing is inference)**.
7. **Pulse the lane edges and background on each beat, and shift the colour and add a sound layer at combo milestones.** Gives the "alive" feel Nicolo asked for. Reserve a 0.1 to 0.3 s shake for milestones only.
8. **Make the phone remote the Duolingo half: big rounded buttons, one action per screen, a springy tap, a gentle wobble for a wrong choice, and a celebration animation on team results.** Duolingo uses motion with a beat and gentle errors, not red.
9. **Onboard with one slow glowing tile, no text, a ghost foot, and nothing that can fail for ten seconds.** Piano Tiles starts on one rule and one tap **(onboarding detail is inference)**.
10. **End with a results screen in this order: stars or crowns, team score, each player's Perfects, one "next song" button, and no gates.** Based on Guitar Hero and Beatstar, **(ordering is inference)**.

Open questions I could not answer from sources: exact hold-tile visuals in Piano Tiles 2 and Magic Tiles 3; where Beatstar puts its judgment text; how projected floor games handle body shadows; any real lumen or contrast target for a dim floor. A quick test on the actual projector will answer the last two faster than research.
