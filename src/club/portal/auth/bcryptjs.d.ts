declare module 'bcryptjs' {
  const bcrypt: {
    hash(password: string, rounds: number): Promise<string>;
    compare(password: string, hash: string): Promise<boolean>;
    hashSync(password: string, rounds: number): string;
  };
  export default bcrypt;
}
