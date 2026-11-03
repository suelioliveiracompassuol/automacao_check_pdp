const https = require("https");
const fs = require("fs");
const path = require("path");


const CONFIG = {
  clientId: process.env.SFCC_CLIENT_ID
  clientSecret: process.env.SFCC_CLIENT_SECRET
  tokenUrl: "https://account.demandware.com/dwsso/oauth2/access_token",
  webdavBase:
    "https://development-na01-natura.demandware.net/on/demandware.servlet/webdav/Sites",
  filePath: "/Impex/mccfeeds/NatBrazil/catalog_development_export_retrofit.psv",
};


async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const credentials = Buffer.from(
      `${CONFIG.clientId}:${CONFIG.clientSecret}`
    ).toString("base64");


    const postData = "grant_type=client_credentials";


    const url = new URL(CONFIG.tokenUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };


    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data).access_token);
        } else {
          reject(new Error(`Token error ${res.statusCode}: ${data}`));
        }
      });
    });


    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}


async function listWebDAVDirectory(token, dirPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.webdavBase + dirPath);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "PROPFIND",
      headers: {
        Authorization: `Bearer ${token}`,
        Depth: "1",
        "Content-Type": "application/xml",
      },
    };


    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 207) {
          console.log("Arquivos encontrados no diretório:");
          console.log(data);
          resolve(data);
        } else {
          reject(
            new Error(`Erro ao listar diretório ${res.statusCode}: ${data}`)
          );
        }
      });
    });


    req.on("error", reject);
    req.end();
  });
}


async function downloadFile(token, filePath, outputName) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.webdavBase + filePath);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };


    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        const outputPath = path.join(__dirname, outputName);
        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          console.log(`Arquivo baixado com sucesso: ${outputPath}`);
          resolve(outputPath);
        });
      } else {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          reject(new Error(`Erro ao baixar arquivo ${res.statusCode}: ${data}`));
        });
      }
    });


    req.on("error", reject);
    req.end();
  });
}


async function main() {
  try {
    console.log("Obtendo token de acesso...");
    const token = await getAccessToken();
    console.log("Token obtido com sucesso!");


    console.log("\nListando arquivos em /Impex/mccfeeds/NatBrazil/...");
    await listWebDAVDirectory(token, "/Impex/mccfeeds/NatBrazil/");


    console.log("\nBaixando catalog_development_export_retrofit.psv...");
    await downloadFile(
      token,
      CONFIG.filePath,
      "catalog_development_export_retrofit.psv"
    );
  } catch (error) {
    console.error("Erro:", error.message);
  }
}


main();
