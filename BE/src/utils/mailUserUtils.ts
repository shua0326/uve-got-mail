import prisma from "../database/prisma"

export async function addFriend(userId: string, friendId: string): Promise<void> {
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
