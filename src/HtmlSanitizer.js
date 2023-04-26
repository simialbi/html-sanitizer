export default class HtmlSanitizer {
    CONTENT_TAG_WHITELIST = {'FROM': true, 'GOOGLE-SHEETS-HTML-ORIGIN': true};
    TAG_WHITELIST = {
        'A': true,
        'ABBR': true,
        'B': true,
        'BLOCKQUOTE': true,
        'BODY': true,
        'BR': true,
        'CENTER': true,
        'CODE': true,
        'DD': true,
        'DIV': true,
        'DL': true,
        'DT': true,
        'EM': true,
        'FONT': true,
        'H1': true,
        'H2': true,
        'H3': true,
        'H4': true,
        'H5': true,
        'H6': true,
        'HR': true,
        'I': true,
        'IMG': true,
        'LABEL': true,
        'LI': true,
        'OL': true,
        'P': true,
        'PRE': true,
        'SMALL': true,
        'SOURCE': true,
        'SPAN': true,
        'STRONG': true,
        'SUB': true,
        'SUP': true,
        'TABLE': true,
        'TBODY': true,
        'TR': true,
        'TD': true,
        'TH': true,
        'THEAD': true,
        'UL': true,
        'U': true,
        'VIDEO': true
    };
    ATTRIBUTE_WHITELIST = {
        'align': true,
        'color': true,
        'controls': true,
        'height': true,
        'href': true,
        'id': true,
        'src': true,
        'style': true,
        'target': true,
        'title': true,
        'type': true,
        'width': true
    };
    CSS_WHITELIST = {
        'background-color': true,
        'color': true,
        'font-size': true,
        'font-weight': true,
        'text-align': true,
        'text-decoration': true,
        'width': true
    };
    SCHEMA_WHITELIST = ['http:', 'https:', 'data:', 'm-files:', 'file:', 'ftp:', 'mailto:', 'pw:'];
    URI_ATTRIBUTES = {
        'href': true,
        'action': true
    };

    /**
     * Class constructor
     * @param {Object} options
     * @param {Array} [options.allowedTags]
     * @param {Array} [options.allowedAttributes]
     * @param {Array} [options.allowedCssStyles]
     * @param {Array} [options.allowedSchemas]
     */
    constructor(options) {
        let i;
        if (options.allowedTags) {
            this.TAG_WHITELIST = {};
            for (i in options.allowedTags) {
                this.TAG_WHITELIST[options.allowedTags[i]] = true;
            }
        }
        if (options.allowedAttributes) {
            this.ATTRIBUTE_WHITELIST = {};
            for (i in options.allowedAttributes) {
                this.ATTRIBUTE_WHITELIST[options.allowedAttributes[i]] = true;
            }
        }
        if (options.allowedCssStyles) {
            this.CSS_WHITELIST = {};
            for (i in options.allowedCssStyles) {
                this.CSS_WHITELIST[options.allowedCssStyles[i]] = true;
            }
        }
        if (options.allowedSchemas) {
            this.SCHEMA_WHITELIST = [];
            for (i in options.allowedSchemas) {
                this.SCHEMA_WHITELIST.push(options.allowedSchemas[i]);
            }
        }
        this.parser = new DOMParser();
    }

    /**
     * Sanitize the input html string (optionally allow an extraSelector)
     *
     * @param {string} input
     * @param {string} [extraSelector]
     *
     * @return {string}
     */
    sanitizeHtml(input, extraSelector) {
        input = input.trim();

        if (input === '') {
            return '';
        }
        //firefox "bogus node" workaround for wysiwyg's
        if (input === '<br>') {
            return '';
        }
        if (input.indexOf('<body') === -1) {
            input = '<body>' + input + '</body>';
        }

        this.doc = this.parser.parseFromString(input, 'text/html');
        //DOM clobbering check (damn you firefox)
        if (this.doc.body.tagName !== 'BODY') {
            this.doc.body.remove();
        }
        if (typeof this.doc.createElement !== 'function') {
            this.doc.createElement.remove();
        }

        let resultElement = this.makeSanitizeCopy(this.doc.body, extraSelector)

        return resultElement.innerHTML
            .replace(/<br[^>]*>/g, "<br>\n$1")
            .replace(/div><div/g, "div>\n<div"); //replace is just for cleaner code
    }

    /**
     * Sanitize the given node by configured class statements
     *
     * @param {Node|HTMLElement} node The node to sanitize
     * @param {string} [extraSelector] An extra selector to allow in addition
     *
     * @return {Node|DocumentFragment|HTMLElement} The sanitized node
     */
    makeSanitizeCopy(node, extraSelector) {
        let newNode;
        if (node.nodeType === Node.TEXT_NODE) {
            newNode = node.cloneNode(true);
        } else if (node.nodeType === Node.ELEMENT_NODE && (this.TAG_WHITELIST[node.tagName] || this.CONTENT_TAG_WHITELIST[node.tagName] || (extraSelector && node.matches(extraSelector)))) {
            if (this.CONTENT_TAG_WHITELIST[node.tagName]) {
                newNode = this.doc.createElement('div');
            } else {
                newNode = this.doc.createElement(node.tagName);
            }

            for (let i in node.attributes) {
                let attr = node.attributes[i];
                if (this.ATTRIBUTE_WHITELIST[attr.name]) {
                    if (attr.name === 'style') {
                        for (let k in node.style) {
                            if (this.CSS_WHITELIST[node.style[k]]) {
                                newNode.style.setProperty(node.style[k], node.style.getPropertyValue(node.style[k]));
                            }
                        }
                    } else {
                        if (this.URI_ATTRIBUTES[attr.name] && attr.value.indexOf(':') > -1 && !this.startWithAny(attr.value, this.SCHEMA_WHITELIST)) {
                            continue;
                        }
                        newNode.setAttribute(attr.name, attr.value);
                    }
                }
            }
            for (let i in node.childNodes) {
                let subCopy = this.makeSanitizeCopy(node.childNodes[i]);
                newNode.appendChild(subCopy, false);
            }

            if ((newNode.tagName === 'SPAN' || newNode.tagName === 'B' || newNode.tagName === 'I' || newNode.tagName === 'U') && newNode.innerHTML.trim() === '') {
                return this.doc.createDocumentFragment();
            }
        } else {
            newNode = this.doc.createDocumentFragment();
        }

        return newNode;
    }

    /**
     * Check if the string `str` starts with any of the passed `substrings`.
     *
     * @param {string} str
     * @param {string[]} substrings
     *
     * @return {boolean}
     */
    startWithAny(str, substrings) {
        for (let i in substrings) {
            if (str.startsWith(substrings[i])) {
                return true;
            }
        }
        return false;
    }
}
