import { Dialog, Notify} from 'quasar'
import './styles/quasar.scss'
import lang from 'quasar/lang/zh-CN.js'
import '@quasar/extras/material-icons/material-icons.css'

// To be used on app.use(Quasar, { ... })
export default {
  config: {},
  plugins: {
    Dialog,
    Notify
  },
  lang: lang
}