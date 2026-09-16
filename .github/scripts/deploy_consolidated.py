from pathlib import Path
import hashlib

path = Path('index.html')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


master = '''<!--
GE CONSOLIDATED MASTER — 2026-09-16
Revision scope begins with: New Game must preserve the selected game / players / controls.
Preserve together:
- New Game + START NEW GAME reset match state only, not selected game/settings/players.
- Play Computer option with bank-capable CPU.
- Count every real launched throw; 369 records rank by fewest winning throws; High Scores accessible from end/options; use REPLAY wording.
- Natural planet friction only; no artificial final-5% braking layer.
- Larger landscape player balls and compact landscape labels.
- Normal album popup: no targeting reticle / Inner Planet Analysis / close button; PLAY ALBUM under title; BUY ON BANDCAMP centered; GRAND ELEMENT never splits; rotating living-energy album planet; standalone Energy Awakening descriptions.
- Quantum reaction changes linked motion only; Comets retain their original normal streak renderer; slower varied departures including rare shared circles.
- Blue Sun Pool: nine numbered album planets in a circular rack, center black pocket opens after break, Blue Sun cue ball, ordered 1-9 pocketing, combinations allowed, wrong ball/scratch loses turn and respots.
- Offline Website + Game share the same page/app/cache; preserve working control-state recovery namespace.
Pending isolated arcade addition: standard six-pocket Grand Element 9-Ball with gaseous pockets, same-size Blue Sun cue ball, numbered planets, rubber-band aiming, nine-ball contact/order rules.
-->'''

replace_once(
    '<!doctype html>\n<html lang="en">',
    '<!doctype html>\n' + master + '\n<html lang="en">',
    'master header'
)

replace_once(
    '          <div class="albumScanTitle" id="albumScanTitle">Album</div>\n          <div class="albumScanMeta" id="albumScanMeta">GRAND ELEMENT ARCHIVE</div>',
    '          <div class="albumScanTitle" id="albumScanTitle">Album</div>\n          <button class="albumScanListen" id="albumScanListen" type="button">PLAY ALBUM</button>\n          <div class="albumScanMeta" id="albumScanMeta">GRAND ELEMENT ARCHIVE</div>',
    'play album button'
)

replace_once(
    "  const bandcamp=document.getElementById('albumScanBandcamp');\n  const kicker=document.getElementById('albumScanKicker');",
    "  const bandcamp=document.getElementById('albumScanBandcamp');\n  const listen=document.getElementById('albumScanListen');\n  const kicker=document.getElementById('albumScanKicker');",
    'play album control reference'
)

replace_once(
    "  const geArchiveFoundation='Grand Element is one continuous experience. Each album adds another dimension as the sound becomes increasingly aware of what it can be. The listener is the Grand Element, so the deeper story is meant to be discovered rather than completely explained.';",
    '  const geArchiveFoundation="Grand Element music is designed to create an open, hypnotic space in the mind where the listener can imagine, reflect and create. Repetition, rhythm and spacious sound are used to quiet ordinary mental chatter, leave room for the listener\'s own inner voice, and let the music speak more directly to the soul.";',
    'archive foundation copy'
)

old_notes = '''    trio:{year:'2006',energy:'Expansion',bio:'A third element changes everything. Guitar bends beyond the keyboard’s fixed frequencies while intricate rhythm frames the expanding sound. Trio takes the original Grand Element forms and opens them into something larger, freer and no longer confined to two opposing sides.'},
    live:{year:'2007',energy:'Collective',bio:'The music leaves the studio and enters physical experience. Performer, sound and audience begin reacting to one another in real time. Live! captures Grand Element at its most immediate, where the people in the room become part of the recording itself.'},
    sessionsi:{year:'2008',energy:'Exploration',bio:'Now the exploration begins. Soul, funk, rock, rhythm and atmosphere become different environments to move through as Grand Element experiments with what this new experience can feel like. Structured songs become little worlds for the listener to enter.'},
    sessionsii:{year:'2009',energy:'Evolution',bio:'The exploration continues and reaches farther. Different styles, emotions and states move through the same underlying energy as the boundaries of Grand Element continue expanding. The sound changes, but something underneath it remains the same.'},
    intergy:{year:'2010',energy:'Inner',bio:'After exploring outward, the journey turns inward toward the energy within. Intergy begins looking beneath the changing environments for the current that has been moving through them all.'},
    love:{year:'2011',energy:'Heart',bio:'The inward journey expands outward again into a larger field of connection, energy and love. The perspective widens, but the movement is still coming from the same center.'},
    soul:{year:'2017',energy:'Joy',bio:'Joy, movement and play come forward. Soul leans into the pleasure of simply experiencing existence, letting rhythm and motion become their own form of understanding.'},
    spirit:{year:'2021',energy:'Polarity',bio:'Polarity becomes mysterious: positive and negative, major and minor, light and darkness. Spirit explores the almost magical interaction between opposites without reducing them to a simple answer.'},
    fire:{year:'2024',energy:'Transformation',bio:'Creation encounters destruction, pain, anger, healing and transformation. Fire keeps stripping the experience down until music itself begins to approach frequency, energy and Source.'}'''

new_notes = '''    trio:{year:'2006',energy:'Expansion',bio:'Trio is designed to create an open, expanding space where structured rhythm and freer melodic movement can exist together. Its energy is about moving beyond two fixed sides and making room for another possibility, giving the listener more space for imagination, movement and their own inner response.'},
    live:{year:'2007',energy:'Collective',bio:'Live! is designed to turn shared experience into part of the music. Spontaneity, reaction and the energy between performers and audience create a living space that invites the listener out of analysis and into direct experience, connection and presence.'},
    sessionsi:{year:'2008',energy:'Exploration',bio:"Sessions I is a collection of musical environments built for exploration. Soul, funk, rock, rhythm and atmosphere move through different forms while leaving enough open space for the listener's own thoughts, melodies and images to appear."},
    sessionsii:{year:'2009',energy:'Evolution',bio:'Sessions II expands that open-ended exploration through a wider range of moods, movement and texture. The album is designed to keep the mind engaged without closing the experience down, allowing different forms of energy to lead the listener toward their own creative and inner response.'},
    intergy:{year:'2010',energy:'Inner',bio:'Intergy is a meditation on the energy within. Repetition, groove and open space are used to quiet ordinary mental chatter and create room for imagination, reflection and a more direct awareness of the energy moving beneath thought.'},
    love:{year:'2011',energy:'Heart',bio:'Love creates a wide, immersive field of connection. Its repeating rhythms and spacious movement are designed to soften the analytical mind and leave room for the listener to experience love as energy: something larger, surrounding and moving through everything.'},
    soul:{year:'2017',energy:'Joy',bio:'Soul is built around joy, movement and play. Its rhythmic, funky energy is meant to loosen the mind, invite creativity and reconnect the listener with the part of themselves that simply wants to move, feel and be alive.'},
    spirit:{year:'2021',energy:'Polarity',bio:'Spirit explores the energy created between opposites: light and darkness, positive and negative, tension and release. The album is designed as a reflective space where those contrasts can be felt rather than solved, giving the listener room to sense what may exist beyond either side.'},
    fire:{year:'2024',energy:'Transformation',bio:'Fire is a meditation on transformation. It moves through creation, destruction, pain, anger, healing and release, using rhythm, repetition and space to give difficult energy somewhere to move, change form and return toward something more fundamental.'}'''
replace_once(old_notes, new_notes, 'standalone album descriptions')

replace_once(
    "    meta.textContent=String(n.energy||'Source').toUpperCase()+' ENERGY · GRAND ELEMENT · '+n.year;",
    "    meta.textContent=String(n.energy||'Source').toUpperCase()+' ENERGY · GRAND\\u00A0ELEMENT · '+n.year;",
    'Grand Element no-wrap'
)

replace_once(
    "  panel.addEventListener('click',e=>{ if(e.target===panel) panel.classList.remove('show'); });",
    "  listen?.addEventListener('click',()=>{\n    if(currentAlbumTitle && window.GE_MUSIC_CONTROLLER?.playAlbum?.(currentAlbumTitle)){\n      panel.classList.remove('show');\n    }\n  });\n  panel.addEventListener('click',e=>{ if(e.target===panel) panel.classList.remove('show'); });",
    'play album behavior'
)

path.write_text(text, encoding='utf-8')
digest = hashlib.sha256(path.read_bytes()).hexdigest()
expected = 'bfb5616c13435c6cdae3f247aad08677562edba741440d56ba0b9d3ce2a5d70d'
if digest != expected:
    raise SystemExit(f'Exact consolidated file check failed: {digest} != {expected}')
print('Exact consolidated index verified:', digest)
