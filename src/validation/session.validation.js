export class Validations {
    static email(email) {
        if (typeof email !== 'string') throw new Error('email must be a string');
        if (email.length < 3) throw new Error('email must be at least 3 characters long');
    }

    static password(password) {
        if (typeof password !== 'string') throw new Error('password must be a string');
        if (password.length < 3) throw new Error('password must be at least 3 characters long');
    }
}