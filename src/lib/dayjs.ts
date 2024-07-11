import localizedFormat from 'dayjs/plugin/localizedFormat'
import 'dayjs/locale/pt-br'
import dayjs from "dayjs";


dayjs.locale('pt-br')
dayjs.extend(localizedFormat)



export { dayjs }