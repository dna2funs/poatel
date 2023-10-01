# gateway

## Usage

```
npm install
GW_SECRET_CHANNEL=demo node index.js
PUB_URL=ws://127.0.0.1:8080/demo/channel node ../service_example/index.js
curl http://127.0.0.1:8080/gw/hello/test
```

## API

- `/api/gw/<region>/<path>`

## Websocket

- `cmd: auth`
- `cmd: register` -> register region to `/api/gw/<region>`
- `cmd: unregister`
- `cmd: req`

