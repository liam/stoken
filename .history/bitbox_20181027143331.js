exports.config = {
  networks: {
    development: {
      restURL: "localhost/v1/"
    },
    production: {
      restURL: "https://rest.bitcoin.com/v1/"
    }
  }
};
