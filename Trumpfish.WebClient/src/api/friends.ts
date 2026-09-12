import { deleteJson, getJson, postJson } from './client';
import type { FriendsView } from './models';

const route = '/friends';

/** Accepted friends with their presence, plus the invitations waiting on either side. */
export function listFriends(): Promise<FriendsView> {
  return getJson<FriendsView>(route);
}

/** Asks an account to be a friend, by the name it signed up with. */
export function inviteFriend(username: string): Promise<FriendsView> {
  return postJson<FriendsView>(`${route}/invite`, { username });
}

export function acceptFriend(friendshipId: string): Promise<FriendsView> {
  return postJson<FriendsView>(`${route}/${friendshipId}/accept`, {});
}

/** Removes a friendship, declines an invitation or withdraws one - the same row goes away in all three cases. */
export function removeFriend(friendshipId: string): Promise<FriendsView> {
  return deleteJson<FriendsView>(`${route}/${friendshipId}`);
}
