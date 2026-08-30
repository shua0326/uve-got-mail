import prisma from "../database/prisma"

/**
 * Connects two users as friends. This is the single place a friendship is
 * created outside `acceptFriendRequest`, so the "nobody is their own friend"
 * invariant is enforced here rather than at each call site.
 *
 * A self-friendship is refused as a no-op rather than a throw: the only caller
 * is `sendMail`, which reaches it *after* the Mail row is committed, and
 * turning a data anomaly into a 500 there would tell the sender their letter
 * failed when it did not. The warning is what surfaces the bug.
 */
export async function addFriend(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) {
        console.warn(`[friends] refused self-friendship for ${userId}`);
        return;
    }

    try {
        await prisma.mailUser.update({
            where: {
                id: userId,
            },
            data: {
                friends: {
                    connect: {
                        id: friendId,
                    },
                },
            },
        })
        return;
    } catch (error) {
        return Promise.reject(error);
    }
}
