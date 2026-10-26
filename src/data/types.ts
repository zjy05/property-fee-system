// EXPORTS: IOwner, IReading, IPrintPaper, ICommunity, ISettings, DEFAULT_SETTINGS, MOCK_OWNERS, MOCK_READINGS
/** 数据同步状态（左下角状态栏展示） */
export interface ISyncState {
  /** idle=未开始 syncing=同步中 synced=已同步 error=同步失败 */
  status: 'idle' | 'syncing' | 'synced' | 'error';
  /** 最近一次同步成功时间 */
  lastSyncAt: Date | null;
  /** 服务器当前时间（HH:mm:ss，本地校准后显示） */
  serverTime: string;
}


/** 小区（收费主体），各小区可单独设置楼栋与收费参数 */
export interface ICommunity {
  id: string;
  name: string;
  /** 楼栋列表，如 中楼 / 东楼 / 西楼 */
  buildings: string[];
  /** 水单价（元/吨） */
  waterPrice: number;
  /** 城市垃圾处理费（元/户/月） */
  garbageFee: number;
  /** 是否启用阶梯电价（true=按全局阶梯计费；false=按本小区固定电价计费） */
  hasTier: boolean;
  /** 小区固定电价（元/度），仅 hasTier=false 时生效 */
  electricPrice: number;
  /** 线路维护费单价（元/度，按当月用电量计收；不需要填 0） */
  lineFee: number;
  /** v1.3.0 水表损耗率（%，抄见数×损耗率=损耗量；不需要填 0） */
  waterLossRate?: number;
  /** v1.3.0 电表损耗率（%，抄见数×损耗率=损耗量；不需要填 0） */
  electricLossRate?: number;
  /** v1.3.0 自定义抄表行名称（默认"自定义"） */
  customMeterName?: string;
}

/** 业主档案 */
export interface IOwner {
  id: string;
  name: string;
  /** 房号/楼层，如 中楼东单元六楼东户（兼容旧数据，打印搜索时使用） */
  roomNo: string;
  /** 归属小区 id */
  communityId: string;
  /** 所属楼栋（小区内），如 中楼 */
  building: string;
  /** 单元，如 东单元 */
  unit?: string;
  /** 房号，如 6楼东户 */
  room?: string;
  phone: string;
  waterMeterNo: string;
  electricMeterNo: string;
  /** 物业费（元/月，每户固定） */
  propertyFee: number;
  createdAt: string;
}

/** 抄表收费记录（每业主每月一条） */
export interface IReading {
  id: string;
  ownerId: string;
  /** 期次，如 2026-09 */
  period: string;
  /** 收据编号，录入时生成 */
  receiptNo: string;
  waterPrev: number;
  waterCurr: number;
  electricPrev: number;
  electricCurr: number;
  /** 当月用量 */
  waterUsage: number;
  electricUsage: number;
  /** 录入时的年度累计用电量（用于判断阶梯与收据展示） */
  yearElectricUsage: number;
  /** 当月电费所在阶梯，如 第一阶梯 */
  electricTier: string;
  /** 录入时按当时单价计算并存储，打印时不再变动 */
  waterAmount: number;
  electricAmount: number;
  /** 线路维护费（元），按当月用电量 × 小区线路维护费单价 */
  lineAmount: number;
  /** 物业费（元） */
  propertyFee: number;
  /** 城市垃圾处理费（元） */
  garbageFee: number;
  /** 合计 = 水费 + 电费 + 线路维护费 + 物业费 + 垃圾处理费 + 自定义款项 */
  totalAmount: number;
  paid: boolean;
  paidDate?: string;
  /** v1.2.9 实收金额（缺省 = totalAmount；未收时 0） */
  paidAmount?: number;
  /** v1.2.9 收费人（收据打印展示，可空） */
  receiver?: string;
  /** v1.2.9 抄表人（收据打印展示，可空） */
  reader?: string;
  /** v1.2.9 备注（缺省自动带阶梯/固定电价说明） */
  note?: string;
  /** v1.3.0 水/电损耗量（抄见数×损耗率），打印单独立列 */
  waterLoss?: number;
  electricLoss?: number;
  /** v1.3.0 自定义抄表行（易达第三行，默认名称取小区 customMeterName） */
  customName?: string;
  customPrev?: number;
  customCurr?: number;
  customUsage?: number;
  customLoss?: number;
  customPrice?: number;
  customAmount?: number;
  /** v1.3.0 三个自定义款项（内容/金额/备注） */
  item1Name?: string;
  item1Amount?: number;
  item1Note?: string;
  item2Name?: string;
  item2Amount?: number;
  item2Note?: string;
  item3Name?: string;
  item3Amount?: number;
  item3Note?: string;
  /** v1.3.0 上次结余（录入时快照该户上期本次结余） */
  lastBalance?: number;
  /** v1.3.0 本次结余 = 上次结余 + 应收 - 实收 */
  curBalance?: number;
  createdAt: string;
}

/** 针式打印纸参数 */
export interface IPrintPaper {
  /** 纸宽（mm） */
  width: number;
  /** 单张纸高（mm，针式连续纸撕单线间距） */
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  /** 行距倍数 */
  lineHeight: number;
  /** 票据字号（px） */
  fontSize: number;
}

export interface IPaperProfile extends IPrintPaper {
  id: string;
  name: string;
}

export interface ISettings {
  /** 收费单位名称 */
  companyName: string;
  /** 票据标题 */
  receiptTitle: string;
  /** 默认水单价（元/吨），各小区可单独覆盖 */
  waterPrice: number;
  /** 默认城市垃圾处理费（元/户/月），各小区可单独覆盖 */
  garbageFee: number;
  /** 阶梯电价：第一档上限（含），年度累计 ≤ 该值为第一阶梯 */
  electricTier1Limit: number;
  /** 阶梯电价：第二档上限（含） */
  electricTier2Limit: number;
  electricTier1Price: number;
  electricTier2Price: number;
  electricTier3Price: number;
  /** 收据编号前缀 */
  receiptNoPrefix: string;
  /** 收据编号起始数字 */
  receiptNoStart: number;
  paper: IPrintPaper;
  /** 针式直打固定打印机名称；留空则用 Windows 默认打印机 */
  printerName?: string;
  /** 自定义纸张档案（宽高/边距/行距/字号），可在打印中心增删改并保存 */
  paperProfiles: IPaperProfile[];
  /** 小区列表（收费参数按小区单独配置） */
  communities: ICommunity[];
  /** 开发者信息（设置页展示，可编辑） */
  developerName: string;
  /** 服务单位/物业公司全称 */
  companyOrg: string;
  /** 统一社会信用代码（营业执照） */
  companyLicenseNo?: string;
  /** 法定代表人 */
  companyLegalPerson?: string;
  /** 公司地址 */
  companyAddress?: string;
  /** 公司电话 */
  companyPhone?: string;
  /** 软件技术负责人 */
  techOwner: string;
  /** 技术负责人联系电话 */
  techPhone: string;
  /** 技术支持说明 */
  techSupport: string;
  /** 项目开源信息（说明或仓库地址） */
  openSource: string;
  /** 当前是否为示例数据 */
  demoSeeded: boolean;
  /**
   * 收据版式模板（可在打印中心切换）：
   * - yida   ：易达标准收据，7 列（项目|本次抄见|上次抄见|抄见数|损耗|单价|金额）
   * - hengji ：演示二期收据，对齐现有 Excel（电费/水费/物业费/增压费/生活垃圾处置费 + 应收/实收）
   * - laolou ：演示小区阶梯收据，对齐「演示小区阶梯电费表.xlsx」打印页（年度合计/内容明细/备注阶梯价）
   */
  receiptTemplate?: 'yida' | 'hengji' | 'laolou';
}

export const DEFAULT_SETTINGS: ISettings = {
  companyName: '演示物业服务处',
  receiptTitle: '收款收据',
  waterPrice: 3.5,
  garbageFee: 5,
  electricTier1Limit: 2160,
  electricTier2Limit: 3120,
  electricTier1Price: 0.56,
  electricTier2Price: 0.61,
  electricTier3Price: 0.86,
  receiptNoPrefix: 'SD',
  receiptNoStart: 1,
  printerName: '',
  paper: {
    width: 180,
    height: 210,
    marginTop: 5,
    marginBottom: 5,
    marginLeft: 13,
    marginRight: 13,
    lineHeight: 1.5,
    fontSize: 14,
  },
  paperProfiles: [
    { id: 'paper-a4', name: 'A4', width: 210, height: 297, marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, lineHeight: 1.5, fontSize: 14 },
    { id: 'paper-210x180', name: '三联 210×180', width: 210, height: 180, marginTop: 5, marginBottom: 5, marginLeft: 13, marginRight: 13, lineHeight: 1.5, fontSize: 14 },
    { id: 'paper-180x210', name: '三联 180×210', width: 180, height: 210, marginTop: 5, marginBottom: 5, marginLeft: 13, marginRight: 13, lineHeight: 1.5, fontSize: 14 },
    { id: 'paper-241x93', name: 'A4 三分之一 241×93', width: 241, height: 93, marginTop: 5, marginBottom: 5, marginLeft: 13, marginRight: 13, lineHeight: 1.5, fontSize: 14 },
    { id: 'paper-140x210', name: '140 三联 140×210', width: 140, height: 210, marginTop: 5, marginBottom: 5, marginLeft: 10, marginRight: 10, lineHeight: 1.5, fontSize: 14 },
  ],
  communities: [
    {
      id: 'c-default',
      name: '演示小区',
      buildings: ['中楼'],
      waterPrice: 3.5,
      garbageFee: 5,
      hasTier: true,
      electricPrice: 0.56,
      lineFee: 0,
    },
  ],
  developerName: '',
  companyOrg: '演示物业服务有限公司',
  techOwner: '演示管理员',
  techPhone: '13800000000',
  techSupport: '系统使用中如有任何问题，请联系软件技术负责人协助处理。',
  openSource: '本项目为开源项目，代码托管于 GitHub（仓库建设中），欢迎共建。',
  demoSeeded: true,
  receiptTemplate: 'hengji',
};

export const MOCK_OWNERS: IOwner[] = [
  {
    id: 'o1',
    name: '李四',
    roomNo: '中楼东单元六楼东户',
    communityId: 'c-default',
    building: '中楼',
    phone: '13800001001',
    waterMeterNo: 'S0101',
    electricMeterNo: 'D0101',
    propertyFee: 38,
    createdAt: '2026-01-05',
  },
  {
    id: 'o2',
    name: '王五',
    roomNo: '中楼东单元五楼东户',
    communityId: 'c-default',
    building: '中楼',
    phone: '13800001002',
    waterMeterNo: 'S0102',
    electricMeterNo: 'D0102',
    propertyFee: 52,
    createdAt: '2026-01-05',
  },
  {
    id: 'o3',
    name: '赵六',
    roomNo: '中楼东单元三楼东户',
    communityId: 'c-default',
    building: '中楼',
    phone: '13800001003',
    waterMeterNo: 'S0103',
    electricMeterNo: 'D0103',
    propertyFee: 52,
    createdAt: '2026-01-05',
  },
];

export const MOCK_READINGS: IReading[] = [
  {
    id: 'r1',
    ownerId: 'o1',
    period: '2026-03',
    receiptNo: 'SD2026030001',
    waterPrev: 0,
    waterCurr: 0,
    electricPrev: 10418,
    electricCurr: 10691,
    waterUsage: 0,
    electricUsage: 273,
    yearElectricUsage: 1609,
    electricTier: '第一阶梯',
    waterAmount: 0,
    electricAmount: 152.88,
    lineAmount: 0,
    propertyFee: 38,
    garbageFee: 5,
    totalAmount: 195.88,
    paid: true,
    paidDate: '2026-04-01',
    createdAt: '2026-04-01',
  },
  {
    id: 'r2',
    ownerId: 'o2',
    period: '2026-03',
    receiptNo: 'SD2026030002',
    waterPrev: 0,
    waterCurr: 0,
    electricPrev: 0,
    electricCurr: 0,
    waterUsage: 0,
    electricUsage: 0,
    yearElectricUsage: 0,
    electricTier: '第一阶梯',
    waterAmount: 0,
    electricAmount: 0,
    lineAmount: 0,
    propertyFee: 52,
    garbageFee: 5,
    totalAmount: 57,
    paid: false,
    createdAt: '2026-04-01',
  },
];
