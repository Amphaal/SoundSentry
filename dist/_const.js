export const SoundVitrineDatabaseFolderPath = process.env.DATA_FOLDER ?? "/srv/data";
// export const SSLCertFolderPath = "/etc/letsencrypt/live"; # we should not use certbot directly, use a proxy instead
export const ListeningPort = 80;
export const ExpectedShoutFileNameOnUserProfile = "shout.json";
export const ExpectedUserDatabaseFileName = "users.json";
export const RWUserID = 1001; // FTP User on docker-compose stack
export const RWGroupID = 1001; // FTP User on docker-compose stack