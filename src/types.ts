export type AccessControlCondition =
  | { operator: string }
  | {
      contractAddress: string;
      chain: string;
      standardContractType: string;
      method: string;
      parameters: string[];
      returnValueTest: {
        comparator: string;
        value: string;
      };
    };

export type BaseEncryptionRules<ContractType extends string> = {
  type: string;
  chain: string;
  contractType: ContractType;
  contractAddress: string;
  minTokenBalance: string;
};

export type EncryptionRules =
  | BaseEncryptionRules<"ERC20" | "ERC721">
  | (BaseEncryptionRules<"ERC1155"> & { tokenId: string });

export type Profile = {
  pfp: string;
  username: string;
  description: string;
};

export type Mention = {
  did: string;
  username: string;
};

export type Post = {
  body: string;
  context?: string;
  master?: string;
  reply_to?: string;
  mentions?: Mention[];
  data?: string;
};

export type EncryptedContent = {
  accessControlConditions: string;
  encryptedSymmetricKey: string;
  encryptedString: string;
};

export type EncryptedPost = Omit<Post, "body"> & {
  encryptedBody: EncryptedContent;
};

export type Reaction = "like" | "haha" | "downvote";

export type Group = {
  pfp: string;
  name: string;
  description: string;
};

export type ChannelType = "chat" | "feed";
export type Channel = {
  type: ChannelType;
  name: string;
  description?: string;
  encryptionRules?: EncryptionRules;
  data?: string;
};

export type Conversation = {
  recipients: string[];
  name?: string;
  description?: string;
  context?: string;
};

export type Message = {
  conversation_id: string;
  body: string;
};
export type EncryptedMessage = Omit<Message, "body"> & {
  encryptedMessage: EncryptedContent;
};

export type GetPostsOptions = {
  context?: string;
  did?: string;
  master?: string;
  algorithm?: "recommendations" | "all-posts" | "all-posts-non-filtered";
};

export type GetConversationsOptions = {
  did: string;
  context: string;
};
