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
  prefix: string
}

const defaultConfig: Config = {
  prefix: '/onein'
}

function readConfigFile(configFileName: string): Config {
  console.log('reading config file: ', configFileName)
  const configObj: Config = fs.existsSync(configFileName) ?
    yaml.parse(fs.readFileSync(configFileName).toString()) :
    defaultConfig
  const prefix = configObj.prefix
  if (!prefix.startsWith('/') || prefix.endsWith('/'))
    throw new TypeError('prefix should start with `/` and not end with `/`')
  return configObj
}

function addPrefix(openapiObj: OpenAPIObject, prefix: string) {
  console.log('adding prefix: ', prefix)
  const newPaths: PathsObject = {}
  for (const path in openapiObj.paths) {
    newPaths[prefix + path] = openapiObj.paths[path]
  }
  openapiObj.paths = newPaths
}

/**
 * convert api format to match onein standard
 * @param openapiObj
 */
function convertApiFormat(openapiObj: OpenAPIObject) {
  console.log('converting api format')
  const components = openapiObj.components ?? {}
  const schemas = components.schemas ?? {}
  for (const key in openapiObj.paths) {
    const path: PathItemObject = openapiObj.paths[key]
    const operations = [
      path.get, path.put, path.post, path.delete, path.head, path.options, path.trace, path.patch
    ]
    for (const operation of operations) {
      if (operation) {
        mergeParametersAndRequestBody(path, operation, schemas)
        wrapResponseBody(path, operation, schemas)
      }
    }
  }
  wrapSchemas(schemas)
  components.schemas = schemas
  openapiObj.components = components
}

function mergeParametersAndRequestBody(path: PathItemObject, operation: OperationObject, schemas: Record<string, SchemaObject>) {
  const parameters = (path.parameters ?? []).concat(operation.parameters ?? []) as ParameterObject[]
  if (parameters.length > 0 || operation.requestBody) {
    console.log('merge parameters and requestBody for operation [%s]', operation.operationId)
    const reqBody = createSchema({
      type: 'object',
      properties: {},
      required: []
    })
    for (const parameter of parameters) {
      const p = parameter
      const nameInReqObj = '_' + p.in + '_' + p.name
      const paramSchema: SchemaObject = p.schema ?? {type: 'string'}
      paramSchema.description = p.description
      if (p.required) reqBody.required.push(nameInReqObj)
      reqBody.properties[nameInReqObj] = paramSchema
    }
    // merge parameters into new requestBody
    const reqSchemaName = '_req_' + operation.operationId
    operation.parameters = undefined
    // todo support non-json content
    const originReqBody = (operation.requestBody as RequestBodyObject | undefined)?.content['application/json']?.schema
    if (originReqBody) reqBody.properties['_jsonBody'] = originReqBody
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

function wrapResponseBody(path: PathItemObject, operation: OperationObject, schemas: Record<string, SchemaObject>) {
  const okBody = operation.responses['200'] as ResponseObject
  if (okBody.content) {
    console.log('wrapping response body for operation [%s]', operation.operationId)
    const jsonRes = okBody.content['application/json']
    if (jsonRes) {
      const jsonSchema = jsonRes.schema!
      if (!jsonSchema.$ref) {
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
      }
    } // else non-json content todo support non-json content
  } // else empty response
}

/**
 * wrap raw array schema into object; wrap primitive array fields into object array fields
 * @param schemas the root node: components.schemas
 */
function wrapSchemas(schemas: Record<string, SchemaObject>) {
  for (const k in schemas) {
    const s = schemas[k]
    const o = s.type === 'object' ? s : createSchema({
      type: 'object',
      properties: {
        '_origin': s
      }
    })
    wrapPrimitiveArrays(o)
    schemas[k] = o
  }
  // add wrapper types(for primitive values) to schemas
  for (const type of ['integer', 'number', 'string', 'boolean'] as const) {
    const refName = '_primitive_' + type
    schemas[refName] = createSchema({
      type: 'object',
      properties: {
        '_v': createSchema({
          type
        })
      }
    })
  }
}


function wrapPrimitiveArrays(schema: SchemaObject) {
  for (const k in schema.properties) {
    const field = schema.properties[k]
    if (!field.$ref) { // skip ref because it will be processed in top level loop
      const f = field as SchemaObject
      if (f.type === 'array') {
        const items = f.items!
        if (!items.$ref) {
          const itemSchema = items as SchemaObject
          if (itemSchema.type !== 'object') {
            f.items = {
              $ref: refPath('_primitive_' + itemSchema.type)
            } as ReferenceObject
          }
        }
      }
    }
  }
}

function refPath(name: string) {
  return '#/components/schemas/' + name
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

  addPrefix(openapiObj, configObj.prefix)
  convertApiFormat(openapiObj)

  return writeOutputFile(openapiObj, inputFileName)
}
