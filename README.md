# Casual Drive

## Usage

## Production

Insatll dependencies

```bash
npm i
```

Specify some configuration in `config.js`, then init the environment

```bash
npm run init
```

Start server

```bash
npm run start
```

Or you can simply start server with init

```bash
npm run start:init
```

If your configuration is changed, you can run the following command to update the runtime config without initing all the environment. Remember that the program will automatically run this conmmand before starting the server.

```bash
npm run reconfigure
```

## Development

To build front-end files, the dependencies installation for development is required.

Run the following command to install dependencies for development.

```bash
npm i -D
```

Build front-end files

```bash
npm run build:dev # for development
npm run build # for production
```

Start server for development, It will automatically rebuild front-end files when files are changed, or restart the server when server files are changed.

```bash
npm run dev
npm run dev:init # start the server with init
```

To replace `npm run dev:init`, your can simply run the following command.

```bash
npm run test
```
