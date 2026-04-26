module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.lifeos.sms.LifeOsSmsPackage;',
        packageInstance: 'new LifeOsSmsPackage()',
      },
    },
  },
};