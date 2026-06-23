/** 独立通讯簿 */
export interface AddressBook {
  id: number;
  name: string;
  contactCount: number;
  colorIndex: number;
  createdAt: number;
  updatedAt: number;
}

/** 联系人（数据库行映射） */
export interface Contact {
  id: number;
  addressBookId: number;
  level1Dir: string;
  level2Dir: string;
  name: string;
  position: string | null;
  officePhone: string | null;
  mobilePhones: string; // 逗号分隔
  colorIndex: number; // -1 = 使用姓名首字符默认颜色
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 联系人表单数据（编辑/新建时使用，mobilePhones 为数组形式） */
export interface ContactFormData {
  name: string;
  level1Dir: string;
  level2Dir: string;
  position: string;
  officePhone: string;
  mobilePhones: string[];
  colorIndex?: number; // 可选，-1 或省略 = 使用姓名默认颜色
}

/** 一级目录汇总 */
export interface Level1Summary {
  level1Dir: string;
  count: number;
  colorIndex: number; // -1 = 使用名称哈希
}

/** 二级目录及其联系人 */
export interface Level2Group {
  level2Dir: string;
  contacts: Contact[];
  colorIndex: number; // -1 = 使用名称哈希
}

/** 完整的目录树节点 */
export interface DirectoryNode {
  level1Dir: string;
  level2Dirs: {
    name: string;
    count: number;
  }[];
  totalCount: number;
}
