exports.config = {
  networks: {
    development: {
      restURL: "localhost:3000/v1/"
    },
    production: {
      restURL: "https://rest.bitcoin.com/v1/"
    }
  }
};
