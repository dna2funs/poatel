const i_path = require('path');
const i_dotenv = require('dotenv');
i_dotenv.config({ path: `.env` });

module.exports = {
   TINY_DEBUG: !!process.env.TINY_DEBUG,
   TINY_HOST: process.env.TINY_HOST || '127.0.0.1',
   TINY_PORT: parseInt(process.env.TINY_PORT || '8080'),
   TINY_HTTPS_CA_DIR: process.env.TINY_HTTPS_CA_DIR ? i_path.resolve(process.env.TINY_HTTPS_CA_DIR) : null,
   TINY_MAX_PAYLOAD: parseInt(process.env.TINY_MAX_PAYLOAD || '128') * 1024,
   GW_SECRET_CHANNEL: process.env.GW_SECRET_CHANNEL,
};
