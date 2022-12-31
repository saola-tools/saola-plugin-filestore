# app-filestore test/example

## Usage

### Run the mongo-server

```
docker run -d \
--name devebot-mongo-server \
-p 27017:27017 \
mongo:3.6.23
```

### Install the ImageMagick

MacOS:

```
brew install imagemagick
```

Ubuntu:

```
sudo apt install imagemagick
```

### Run the example server

Build the module:

```shell
npm run build
```

Start the example:

```shell
export DEBUG=devebot*,app*
export LOGOLITE_DEBUGLOG_ENABLED=true
node test/example
```

### How to upload files

You can upload a file using the __curl__ utility:

```shell
curl -i -X POST \
-H "Content-Type: multipart/form-data" \
-F "data=@./test/lab/images/logbeat.png" \
-F "fileId=612d388f-0569-427f-88ad-257e52a3b1a5" \
"http://localhost:7979/example/upload"
```

### How to download files

Assert the output dir has been created:

```
mkdir -p test/tmp/
```

Download the file using `curl`:

```
curl http://localhost:7979/example/download/612d388f-0569-427f-88ad-257e52a3b1a5 \
--output test/tmp/logbeat.png
```

Download and crop the picture using `curl`:

```
curl http://localhost:7979/example/picture/612d388f-0569-427f-88ad-257e52a3b1a5/512/200 \
--output test/tmp/logbeat-512-200.png
```
