import { PostItem } from 'realm-of-aethelraed';

const at = (minutesAgo: number) => ({ toDate: () => new Date(Date.now() - minutesAgo * 60000) });
const me = { uid: 'u-aldric' };

const seraphine = {
  id: 'p-1', userId: 'u-seraphine', characterId: 'c-seraphine',
  characterName: 'Seraphine Ashdown', characterRace: 'Human', characterClass: 'Wizard / Mage',
  characterImageUrl: '', characterImagePosition: 'center', status: 'approved' as const, createdAt: at(180),
  content: 'The smoke rose in a single black thread from beyond the ridge. Seraphine drew her cloak tight and studied it.\n\n"That is no campfire," she murmured. "That is the old waystation burning."'
};

const aldric = {
  id: 'p-2', userId: 'u-aldric', characterId: 'c-aldric',
  characterName: 'Aldric Vane', characterRace: 'Human', characterClass: 'Paladin',
  characterImageUrl: '', characterImagePosition: 'center', status: 'approved' as const, createdAt: at(45), isEdited: true,
  content: 'Aldric reined in beside her, the ember sigil on his shield catching the last of the light.\n\n"Then someone wanted it gone before we arrived. We ride at first light — **quietly**." He nodded toward [[Emberfall Keep]].'
};

const wrap = (children: React.ReactNode) => <div className="max-w-3xl bg-ink-950 p-4">{children}</div>;

export const OtherPlayersPost = () => wrap(<PostItem post={seraphine} user={me} activeCharId="c-aldric" />);

export const OwnPost = () => wrap(<PostItem post={aldric} user={me} activeCharId="c-aldric" />);

export const Editing = () => wrap(
  <PostItem post={aldric} user={me} activeCharId="c-aldric" editingPostId="p-2" editPostContent={aldric.content} />
);

export const ModeratorView = () => wrap(
  <PostItem post={seraphine} user={{ uid: 'u-mod' }} activeCharId={null} isAdmin isAdminOrMod />
);
