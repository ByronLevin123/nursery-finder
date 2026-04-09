import 'dotenv/config'
import app from './app.js'
import { logger } from './logger.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'CompareTheNursery API started')
})
