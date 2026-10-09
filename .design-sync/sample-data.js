// Sample world served to the components in Claude Design (via the Firestore
// stand-in). Shapes mirror the real documents. Pass your own through
// <AllaniaProvider data={...}> to show different content.
import { Timestamp } from './stubs/timestamp.js';

const APP = 'artifacts/realm-of-allania-v2';
const DATA = `${APP}/public/data`;
const ago = (minutes) => Timestamp.fromMillis(Date.now() - minutes * 60000);

export const SAMPLE_USER = {
  uid: 'u-aldric',
  displayName: 'Wanderer',
  email: 'wanderer@example.com',
  emailVerified: true,
  isAnonymous: false
};

export const SAMPLE_CHARACTERS = [
  { id: 'c-aldric', name: 'Aldric Vane', race: 'Human', class: 'Paladin', description: 'A knight of the Ember Oath, sworn to guard the eastern passes.', imageUrl: '', imagePosition: 'center', createdAt: ago(60 * 24 * 210), likesReceived: 128 },
  { id: 'c-lyra', name: 'Lyra Moonwhisper', race: 'Elf', class: 'Ranger / Hunter', description: 'Tracker of the Silverwood, quiet as falling snow.', imageUrl: '', imagePosition: 'center', createdAt: ago(60 * 24 * 330), likesReceived: 63 }
];

// Like counts (kept by the countPostLikes function in the app)
const LIKES = { 'p-1': 3, 'p-2': 1, 'p-3': 5 };

const post = (id, threadId, minutesAgo, userId, characterId, characterName, characterRace, characterClass, content, extra = {}) => [id, {
  threadId, userId, characterId, characterName, characterRace, characterClass,
  characterImageUrl: '', characterImagePosition: 'center',
  content, status: 'approved', createdAt: ago(minutesAgo), likeCount: LIKES[id] ?? 0, ...extra
}];

export const SAMPLE_DATA = {
  // Public author names (profiles) and the Landing page counts
  [`${DATA}/profiles`]: {
    'u-aldric': { displayName: 'Wanderer', likesReceived: 6, createdAt: ago(60 * 24 * 90) },
    'u-seraphine': { displayName: 'Emberquill', likesReceived: 3, createdAt: ago(60 * 24 * 200) },
    'u-brannock': { displayName: 'Stonefist', likesReceived: 5, createdAt: ago(60 * 24 * 30) }
  },
  [`${DATA}/stats`]: { site: { members: 1243, characters: 312, posts: 15382, regions: 12 } },
  [`${DATA}/region_metadata`]: {
    '125': { name: 'Thornwatch Ridge', blurb: 'Wind-scoured cliffs above the old border road.' },
    '130': { name: 'The Saltmarsh Reach' },
    '166': { name: 'Emberfall Keep', blurb: 'A fortress of red stone on the eastern frontier, seat of the Ember Oath.' },
    '190': { name: 'Silverwood' }
  },
  [`${DATA}/threads`]: {
    't-ember': { title: 'Smoke over the Ember Road', regionId: '125', creatorId: 'u-seraphine', createdBy: 'Seraphine Ashdown', characterId: 'c-seraphine', status: 'approved', postCount: 4, createdAt: ago(2880), updatedAt: ago(18), bannerUrl: '', bannerPosition: 'center',
      tags: ['Roleplay', 'Ongoing'], views: 124, excerpt: 'The smoke rose in a single black thread from beyond the ridge. Seraphine drew her cloak tight and studied it.',
      lastPostBy: 'Lyra Moonwhisper', lastPostCharacterId: 'c-lyra', lastPostUserId: 'u-aldric', lastPostAt: ago(18), openingPostId: 'p-1' },
    't-watch': { title: 'The Night Watch at Thornwatch', regionId: '125', creatorId: 'u-aldric', createdBy: 'Aldric Vane', characterId: 'c-aldric', status: 'approved', postCount: 2, createdAt: ago(5000), updatedAt: ago(240), isLocked: true,
      tags: ['Lore'], views: 312, excerpt: 'The oath of the night watch, as it has been spoken at Thornwatch for three hundred years.',
      lastPostBy: 'Aldric Vane', lastPostCharacterId: 'c-aldric', lastPostUserId: 'u-aldric', lastPostAt: ago(240) },
    't-relic': { title: 'A Relic Beneath the Ridge', regionId: '125', creatorId: 'u-brannock', createdBy: 'Brannock Ironhide', characterId: 'c-brannock', status: 'approved', postCount: 1, createdAt: ago(9000), updatedAt: ago(4300),
      tags: ['Adventure', 'Open'], views: 41, excerpt: 'Old dwarven stonework has surfaced under the ridge. Brannock is looking for hands to help him dig.',
      lastPostBy: 'Brannock Ironhide', lastPostCharacterId: 'c-brannock', lastPostUserId: 'u-brannock', lastPostAt: ago(4300) },
    't-marsh': { title: 'Lanterns in the Saltmarsh', regionId: '130', creatorId: 'u-seraphine', createdBy: 'Seraphine Ashdown', characterId: 'c-seraphine', status: 'approved', postCount: 3, createdAt: ago(7000), updatedAt: ago(95),
      tags: ['Investigation', 'Ongoing'], views: 97, excerpt: 'Lanterns have been seen moving over the marsh where no path runs.',
      lastPostBy: 'Seraphine Ashdown', lastPostCharacterId: 'c-seraphine', lastPostUserId: 'u-seraphine', lastPostAt: ago(95) },
    't-keep': { title: 'Council at Emberfall Keep', regionId: '166', creatorId: 'u-brannock', createdBy: 'Brannock Ironhide', characterId: 'c-brannock', status: 'approved', postCount: 5, createdAt: ago(12000), updatedAt: ago(30),
      tags: ['Roleplay', 'Politics'], views: 208, excerpt: 'The council hall smelled of pitch and old iron.',
      lastPostBy: 'Brannock Ironhide', lastPostCharacterId: 'c-brannock', lastPostUserId: 'u-brannock', lastPostAt: ago(30) }
  },
  [`${DATA}/posts`]: Object.fromEntries([
    post('p-1', 't-ember', 2880, 'u-seraphine', 'c-seraphine', 'Seraphine Ashdown', 'Human', 'Wizard / Mage',
      'The smoke rose in a single black thread from beyond the ridge. Seraphine drew her cloak tight and studied it.\n\n"That is no campfire," she murmured. "That is the old waystation burning."'),
    post('p-2', 't-ember', 1440, 'u-aldric', 'c-aldric', 'Aldric Vane', 'Human', 'Paladin',
      'Aldric reined in beside her, the ember sigil on his shield catching the last of the light.\n\n"Then someone wanted it gone before we arrived. We ride at first light — **quietly**."'),
    post('p-3', 't-ember', 300, 'u-brannock', 'c-brannock', 'Brannock Ironhide', 'Dwarf', 'Warrior / Fighter',
      '*Brannock spat into the dust.* "Quiet is for thieves and mice. If there\'s trouble at the waystation, I\'d sooner meet it with an axe than a whisper." He glanced toward [[Emberfall Keep]].', { isEdited: true }),
    post('p-4', 't-ember', 18, 'u-aldric', 'c-lyra', 'Lyra Moonwhisper', 'Elf', 'Ranger / Hunter',
      'Lyra dropped from the branches without a sound. "Six riders went east an hour ago. Their horses were shod with silver — not bandits, then."'),
    post('p-5', 't-watch', 5000, 'u-aldric', 'c-aldric', 'Aldric Vane', 'Human', 'Paladin',
      'The oath of the night watch, as it has been spoken at Thornwatch for three hundred years: *we keep the fire so others may sleep.*'),
    post('p-6', 't-keep', 30, 'u-brannock', 'c-brannock', 'Brannock Ironhide', 'Dwarf', 'Warrior / Fighter',
      'The council hall smelled of pitch and old iron. Brannock set the broken signet on the table for all to see.')
  ]),
  [`${DATA}/codex_pages`]: {
    'k-keep': { title: 'Emberfall Keep', category: 'Locations', tags: ['Fortress', 'Frontier'], content: 'A fortress of red stone on the eastern frontier, seat of the **Ember Oath**. Its beacon has never gone dark.', gallery: [], status: 'approved', creatorId: 'u-brannock', lastEditorId: 'u-brannock', updatedBy: 'Brannock Ironhide', updatedAt: ago(600) },
    'k-oath': { title: 'The Ember Oath', category: 'Organizations', tags: ['Order', 'Faith'], content: 'An order of knights sworn to keep the beacons of the frontier lit. Members bear the ember sigil.', gallery: [], status: 'approved', creatorId: 'u-aldric', lastEditorId: 'u-aldric', updatedBy: 'Aldric Vane', updatedAt: ago(3000), isLocked: true },
    'k-aldric': { title: 'Aldric Vane', category: 'Characters', tags: ['Knight', 'Ember Oath'], content: '> The beacon stays lit while I stand.\n\n**Race:** Human\n**Class:** Paladin\n**Order:** [[The Ember Oath]]\n**Post:** [[Emberfall Keep]]\n\nA knight of the Ember Oath, sworn to guard the eastern passes.\n\nAldric took his vows at seventeen, the youngest in a generation. He has held the Thornwatch road through three winters and two sieges, and speaks of neither.\n\nThose who ride with him say he prays before every fight and laughs after it.\n\n> Some knights guard walls. Aldric guards the people behind them.', gallery: [], status: 'approved', creatorId: 'u-aldric', lastEditorId: 'u-aldric', updatedBy: 'Aldric Vane', relatedId: 'c-aldric', updatedAt: ago(9000) },
    'k-silver': { title: 'Silverwood', category: 'Locations', content: 'An ancient forest where the trees hold their leaves through winter and the elves keep their own counsel.', gallery: [], status: 'approved', creatorId: 'u-seraphine', lastEditorId: 'u-seraphine', updatedBy: 'Seraphine Ashdown', updatedAt: ago(20000) }
  },
  [`${APP}/presence`]: {
    'u-aldric': { username: 'Wanderer', lastSeen: ago(1) },
    'u-seraphine': { username: 'Ashdown', lastSeen: ago(3) },
    'u-brannock': { username: 'Ironhide', lastSeen: ago(9) }
  },
  [`${APP}/users/u-aldric/characters`]: Object.fromEntries(SAMPLE_CHARACTERS.map(({ id, ...c }) => [id, c])),
  [`${APP}/users/u-seraphine/characters`]: { 'c-seraphine': { name: 'Seraphine Ashdown', race: 'Human', class: 'Wizard / Mage', createdAt: ago(60 * 24 * 280), likesReceived: 201 } },
  [`${APP}/users/u-brannock/characters`]: { 'c-brannock': { name: 'Brannock Ironhide', race: 'Dwarf', class: 'Warrior / Fighter', createdAt: ago(60 * 24 * 420), likesReceived: 344 } },
  [`${APP}/users/u-aldric/notifications`]: {
    'n-1': { type: 'reply', message: 'Seraphine Ashdown replied in "Smoke over the Ember Road".', read: false, createdAt: ago(18) },
    'n-2': { type: 'promotion', message: 'Your codex page "The Ember Oath" was approved.', read: false, createdAt: ago(300) },
    'n-3': { type: 'content_rejected', message: 'Your post was rejected: Content contains forbidden keyword: free money', read: true, createdAt: ago(4000) }
  },
  [`${APP}/chats`]: {
    'chat-1': { participants: ['u-aldric', 'u-seraphine'], participantCharacters: { 'u-aldric': 'c-aldric', 'u-seraphine': 'c-seraphine' }, lastMessage: 'Meet me at the waystation at dusk.', updatedAt: ago(12) },
    'chat-2': { participants: ['u-aldric', 'u-brannock'], participantCharacters: { 'u-aldric': 'c-lyra', 'u-brannock': 'c-brannock' }, lastMessage: 'Bring the signet.', updatedAt: ago(800) }
  },
  [`${APP}/chats/chat-1/messages`]: {
    'm-1': { senderId: 'u-seraphine', text: 'Did you see the smoke from the ridge?', createdAt: ago(40) },
    'm-2': { senderId: 'u-aldric', text: 'I did. The old waystation, I think.', createdAt: ago(35) },
    'm-3': { senderId: 'u-seraphine', text: 'Meet me at the waystation at dusk.', createdAt: ago(12) }
  }
};

// Thread/codex ids the signed-in sample user has read (GameContext readReceipts)
export const SAMPLE_READ_RECEIPTS = { 't-watch': Date.now(), 't-relic': Date.now() };
