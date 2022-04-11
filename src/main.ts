import yaml from 'yaml'
import * as fs from 'fs'
import {
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject
} from 'openapi3-ts'
import {PathItemObject, PathsObject} from 'openapi3-ts/src/model/OpenApi'

function readInputFile(inputFileName: string) {
  console.log('reading input file: ', inputFileName)
  const openapiObj: OpenAPIObject = yaml.parse(fs.readFileSync(inputFileName).toString())
  return openapiObj
}

interface Config {
  prefix?: string,
  commonParameters?: ParameterObject[]
}

const defaultConfig: Required<Config> = {
  prefix: '/onein',
  commonParameters: []
}

function readConfigFile(configFileName: string) {
  console.log('reading config file: ', configFileName)
  const configObj: Config = fs.existsSync(configFileName) ?
    yaml.parse(fs.readFileSync(configFileName).toString()) :
    {}
  if (!configObj.prefix) configObj.prefix = defaultConfig.prefix
  if (!configObj.commonParameters) configObj.commonParameters = defaultConfig.commonParameters
  return configObj as Required<Config>
}

function addPrefix(openapiObj: OpenAPIObject, prefix: string) {
  console.log('adding prefix: ', prefix)
  const newPaths: PathsObject = {}
  for (const path in openapiObj.paths) {
    newPaths[prefix + path] = openapiObj.paths[path]
  }
  openapiObj.paths = newPaths
}

const HttpMethods = ['get', 'put', 'post', 'delete', 'head', 'options', 'trace', 'patch'] as const

/**
 * convert api format to match onein standard
 * @param openapiObj
 * @param commonParameters
 */
function convertApiFormat(openapiObj: OpenAPIObject, commonParameters: ParameterObject[]) {
  console.log('converting api format, commonParameters: %o', commonParameters)
  const components = openapiObj.components ?? {}
  const schemas = components.schemas ?? {}
  createArraySchemaWrappers(schemas)
  for (const k in schemas) {
    const o = schemas[k]
    wrapPrimitiveArrays(schemas, k, o)
  }
  createPrimitiveSchemaWrappers(schemas)
  const newPaths: PathsObject = {}
  for (const key in openapiObj.paths) {
    const path: PathItemObject = openapiObj.paths[key]
    for (const httpMethod of HttpMethods) {
      const operation = path[httpMethod]
      if (operation) {
        const newKey = `${key}/${httpMethod}`.replace(
          /\/{/g, '/['
        ).replace(
          /}\//g, ']/'
        )
        let newPathItem: PathItemObject = newPaths[newKey]
        if (newPathItem === undefined) {
          newPathItem = {}
          newPaths[newKey] = newPathItem
        }
        newPathItem.post = operation
        mergeParametersAndRequestBody(path, operation, schemas, commonParameters)
        wrapResponseBody(path, operation, schemas)
      }
    }
  }
  components.schemas = schemas
  openapiObj.components = components
  openapiObj.paths = newPaths
}

function mergeParametersAndRequestBody(
  path: PathItemObject,
  operation: OperationObject,
  schemas: Record<string, SchemaObject>,
  commonParameters: ParameterObject[]
) {
  const parameters = [
    ...commonParameters,
    ...path.parameters ?? [],
    ...operation.parameters ?? []
  ] as ParameterObject[]
  if (parameters.length > 0 || operation.requestBody) { // if operation does not have req body, there is no need to set method manually
    console.log('merge parameters and requestBody for operation [%s]', operation.operationId)
    const reqBody = createSchema({
      type: 'object',
      properties: {}
    })
    for (const parameter of parameters) {
      const p = parameter
      const nameInReqObj = '_' + p.in + '_' + p.name
      const paramSchema: SchemaObject = p.schema ?? {type: 'string'}
      paramSchema.description = p.description
      if (p.required) addRequired(reqBody, nameInReqObj)
      reqBody.properties[nameInReqObj] = paramSchema
    }
    // merge parameters into new requestBody
    const reqSchemaName = '_req_' + operation.operationId
    operation.parameters = undefined
    // todo support non-json content
    const originReqBody = (operation.requestBody as RequestBodyObject | undefined)?.content['application/json']?.schema
    if (originReqBody) {
      const originReqBodySchema = unwrapRef(originReqBody.$ref, schemas, true)
      Object.assign(reqBody.properties, originReqBodySchema.properties)
      if (originReqBodySchema.required) addRequired(reqBody, ...originReqBodySchema.required)
    }
    // set new requestBody ref to operation
    operation.requestBody = {
      content: {
        'application/json': {
          schema: {
            $ref: refPath(reqSchemaName)
          }
        }
      }
    } as RequestBodyObject
    // deal with arrays
    schemas[reqSchemaName] = reqBody
  }
}

function addRequired(schema: SchemaObject, ...params: string[]) {
  if (!schema.required) schema.required = []
  schema.required.push(...params)
}

function wrapResponseBody(path: PathItemObject, operation: OperationObject, schemas: Record<string, SchemaObject>) {
  const okBody = operation.responses['200'] as ResponseObject
  if (okBody.content) {
    console.log('wrapping response body for operation [%s]', operation.operationId)
    const jsonRes = okBody.content['application/json']
    if (jsonRes) {
      const jsonSchema = jsonRes.schema!
      const resSchemaName = '_res_' + operation.operationId
      schemas[resSchemaName] = createSchema({
        type: 'object',
        properties: {
          '_jsonBody': jsonSchema
        }
      })
      jsonRes.schema = {
        $ref: refPath(resSchemaName)
      }
    } // else non-json content todo support non-json content
  } // else empty response
}

/**
 * create wrappers for array schemas
 * @param schemas
 */
function createArraySchemaWrappers(schemas: Record<string, SchemaObject>) {
  const arrayWrappers: Record<string, SchemaObject> = {}
  for (const k in schemas) {
    const schema = schemas[k]
    if (schema.type === 'array') {
      arrayWrappers['_array_' + k] = createSchema({
        type: 'object',
        properties: {
          '_v': {
            $ref: refPath(k)
          }
        },
        required: ['_v']
      })
    }
  }
  for (const k in arrayWrappers) {
    schemas[k] = arrayWrappers[k]
  }
}

/**
 * create wrappers for primitive schemas
 * @param schemas
 */
function createPrimitiveSchemaWrappers(schemas: Record<string, SchemaObject>) {
  for (const type of ['integer', 'number', 'string', 'boolean'] as const) {
    const refName = '_primitive_' + type
    schemas[refName] = createSchema({
      type: 'object',
      properties: {
        '_v': createSchema({
          type
        })
      },
      required: ['_v']
    })
  }
}

/**
 * ignore non-object schema
 * @param schemas
 * @param schemaName
 * @param schema
 */
function wrapPrimitiveArrays(schemas: Record<string, SchemaObject>, schemaName: string, schema: SchemaObject) {
  if (schema.type === 'object') {
    for (const k in schema.properties) {
      const field = schema.properties[k]
      if (typeof field.$ref !== 'string') { // skip ref because it will be processed in top level loop
        wrapPrimitiveArray(schemas, field, `${schemaName}.${k}`)
      }
    }
  } else if (schema.type === 'array') {
    wrapPrimitiveArray(schemas, schema, schemaName)
  } // else primitive schemas
}

function wrapPrimitiveArray(schemas: Record<string, SchemaObject>, schema: SchemaObject, schemaName: string) {
  if (schema.type === 'array') {
    const itemSchema = unwrapRef(schema.items!, schemas)
    if (itemSchema.type === 'array') throw new TypeError(`unsupported nested array type: [${schemaName}]`)
    if (itemSchema.type !== 'object') {
      schema.items = {
        $ref: refPath('_primitive_' + itemSchema.type)
      } as ReferenceObject
    }
  }
}

function refPath(name: string) {
  return '#/components/schemas/' + name
}

function getSchemaNameFromRefPath(refPath: string) {
  const prefix = '#/components/schemas/'
  if (refPath.startsWith(prefix)) return refPath.substring(prefix.length)
  else throw new TypeError(`unsupported non-local ref: ${refPath}`)
}

function getSchema(schemas: Record<string, SchemaObject>, refPath: string, returnWrapType = false) {
  const schemaName = getSchemaNameFromRefPath(refPath)
  const schema = schemas[schemaName]
  if (!schema) throw new TypeError('ref target not found: ' + refPath)
  if (returnWrapType && schema.type !== 'object') {
    if (schema.type === 'array') return schemas['_array_' + schemaName]
    else return schemas['_primitive_' + schema.type]
  }
  return schema
}

function unwrapRef(item: SchemaObject | ReferenceObject, schemas: Record<string, SchemaObject>, returnWrapType = false) {
  if (typeof item.$ref === 'string')
    return getSchema(schemas, item.$ref, returnWrapType)
  else
    return item as SchemaObject
}

function createSchema<K extends keyof SchemaObject>(p: { [k in K]: SchemaObject[k] }) {
  return p as Exclude<SchemaObject, typeof p> & { [k in keyof typeof p]-?: Exclude<SchemaObject[k], undefined> }
}

function writeOutputFile(openapiObj: any, inputFileName: string) {
  const outputFileName = inputFileName.replace('.yaml', '.onein.json')
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

  addPrefix(openapiObj, configObj.prefix ?? '')
  convertApiFormat(openapiObj, configObj.commonParameters)

  return writeOutputFile(openapiObj, inputFileName)
}
