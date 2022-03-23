#!node

import {main} from './main'

main(
  process.argv[2] || 'openapi.yaml',
  process.argv[3] || 'wanying.yaml'
)
