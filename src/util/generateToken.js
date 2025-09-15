
/* 
* 48-57 NUMEROS 10
* 65-90 UPPERCASE 26
* 97-122 LOWERCASE 26
*/

export const generateTempToken = (lenght) => {

    const opts = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
    let token = "";
    for (let i = 0; i < lenght; i++) {
        const rand = Math.round(Math.random() * opts.length);
        token += opts[rand];
    }
    return(token);
}

