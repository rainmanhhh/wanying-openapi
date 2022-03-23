import yaml from 'yaml'
import * as fs from 'fs'

function readInputFile(inputFileName: string) {
  console.log('reading input file: ', inputFileName)
  const openapiObj: {
    paths: Record<string, any>
  } = yaml.parse(fs.readFileSync(inputFileName).toString())
  return openapiObj
}

function readConfigFile(configFileName: string) {
  console.log('reading config file: ', configFileName)
  const configObj: {
    prefix: string
  } = yaml.parse(fs.readFileSync(configFileName).toString())
  const prefix = configObj.prefix
  if (!prefix.startsWith('/') || prefix.endsWith('/'))
    throw new TypeError('prefix should start with `/` and not end with `/`')
  return configObj
}

function addPrefix(openapiObj: Record<string, any>, prefix: string) {
  console.log('adding prefix: ', prefix)
  const newPaths: Record<string, any> = {}
  for (const path in openapiObj.paths) {
    newPaths[prefix + path] = openapiObj.paths[path]
  }
  openapiObj.paths = newPaths
}

function writeOutputFile(openapiObj: any, inputFileName: string) {
  const outputFileName = inputFileName.replace('.yaml', '.wanying.json')
  console.log('writing output file: ', outputFileName)
  const outputString = JSON.stringify(openapiObj)
  fs.writeFileSync(outputFileName, outputString)
  return outputFileName
}

export function main(
  inputFileName: string,
  configFileName: string
) {
  const openapiObj = readInputFile(inputFileName)
  const configObj = readConfigFile(configFileName)

  addPrefix(openapiObj, configObj.prefix)

  return writeOutputFile(openapiObj, inputFileName)
}
