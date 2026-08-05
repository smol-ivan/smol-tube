import { InMemoryConnectionRepository } from "../repositories/InMemoryConnectionRepository";
import { InMemoryRoomRepository } from "../repositories/InMemoryRoomRepository";
import { InMemoryUserRepository } from "../repositories/InMemoryUserRepository";

export const roomRepository = new InMemoryRoomRepository();
export const userRepository = new InMemoryUserRepository();
export const connectionRepository = new InMemoryConnectionRepository();
