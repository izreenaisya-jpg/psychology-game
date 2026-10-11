-- Covers the player/room foreign key used when removing or validating a player.
create index answers_player_room on jom_private.answers(player_id, room_id);
