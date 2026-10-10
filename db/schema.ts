import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('live_rooms', {
 id:text('id').primaryKey(), code:text('code').notNull(), ownerId:text('owner_id').notNull(), title:text('title').notNull(),
 state:text('state').notNull(), questionIndex:integer('question_index').notNull(), deckJson:text('deck_json').notNull(),
 seconds:integer('seconds').notNull(), speedBonus:integer('speed_bonus').notNull(), openedAt:integer('opened_at'), closesAt:integer('closes_at'),
 createdAt:integer('created_at').notNull(), updatedAt:integer('updated_at').notNull(), version:integer('version').notNull()
},t=>[uniqueIndex('live_room_code').on(t.code),index('live_room_owner').on(t.ownerId,t.createdAt)]);
export const players = sqliteTable('live_players',{
 id:text('id').primaryKey(),roomId:text('room_id').notNull().references(()=>rooms.id),nickname:text('nickname').notNull(),nameKey:text('name_key').notNull(),
 tokenHash:text('token_hash').notNull(),joinedAt:integer('joined_at').notNull()
},t=>[uniqueIndex('live_player_name').on(t.roomId,t.nameKey),uniqueIndex('live_player_token').on(t.tokenHash)]);
export const answers = sqliteTable('live_answers',{
 roomId:text('room_id').notNull().references(()=>rooms.id),playerId:text('player_id').notNull().references(()=>players.id),
 questionIndex:integer('question_index').notNull(),choice:integer('choice').notNull(),answeredAt:integer('answered_at').notNull(),elapsedMs:integer('elapsed_ms').notNull(),
 correct:integer('correct').notNull(),points:integer('points').notNull()
},t=>[uniqueIndex('live_answer_once').on(t.roomId,t.playerId,t.questionIndex),index('live_answer_round').on(t.roomId,t.questionIndex)]);
