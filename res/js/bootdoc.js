/**
 * Construct the module list from source.
 * The module list is located in the source
 * because it must also work with noscript.
 */
function reapModuleList() {
    var modules = new Array();

    $('#module-list-source').find('li > a').each(function() {
	modules.push($(this).text());
    });

    return modules;
}

/**
 * Build a table representing the module hierarchy of the project
 * given a linear list of modules.
 */
function buildModuleTree(modlist) {
    var root = {'members': {}};

    for (var i = 0; i < modlist.length; i++) {
	var qualifiedName = modlist[i];
	var parts = qualifiedName.split('::');

	var parent = root;
	for(var partIndex = 0; partIndex < parts.length; partIndex++) {
	    var name = parts[partIndex];
	    var node;

	    if(partIndex == parts.length - 1) {
		node = {'type': 'module', 'qualifiedName': qualifiedName, 'members': {}};
		if (parent.type == 'module') {
		    parent.type = 'module_package';
		}
		parent.members[name] = node;
	    } else {
		node = parent.members[name];
		if(typeof node == "undefined") {
		    node = {'type': 'package', 'members': {}};
		    parent.members[name] = node;
		}
	    }

	    parent = node;
	}
    }

    return root;
}

/**
 * Build a path to the appropriate resource for a fully qualified module name,
 * respecting the global PackageSeparator variable.
 */
function qualifiedModuleNameToUrl(modName) {
    if(PackageSeparator == '.') {
	return modName + '.html';
    } else {
	return modName.replace(/\::/g, PackageSeparator) + '.html';
    }
}

/**
 * Create the module list in the sidebar.
 */
function populateModuleList(modTree) {
    function treePackageNode(name) {
	return '<li class="dropdown sidebar-list-entry">' +
	    '<a class="tree-node" href="javascript:;" title="' + name + '"><i class="icon-th-list"></i> ' + name + '<b class="caret"></b></a>' +
	    '<ul class="custom-icon-list"></ul></li>';
    }

    function treeModulePackageNode(name, url) {
	return '<li class="sidebar-list-entry">' +
	    '<a class="tree-leaf tree-node" href="' + url + '" title="' + name + '"><i class="icon-th-list"></i> ' + name + '<b class="caret"></b></a>' +
	    '<ul class="custom-icon-list"></ul></li>';
    }

    function treeModuleNode(name, url) {
	return '<li class="sidebar-list-entry">' +
	    '<a class="tree-leaf" href="' + url + '" title="' + name + '"><i class="icon-th"></i> ' + name + '</a>' +
	    '</li>';
    }

    var $listHeader = $('#module-list');

    function traverser(node, $parentList) {
	for(var name in node.members) {
	    var member = node.members[name];

	    if(member.type == 'package') {
		var $elem = $(treePackageNode(name));
		$parentList.append($elem);

		var $ul = $elem.find('ul');
		if($parentList != $listHeader) {
		    $ul.hide();
		}

		traverser(member, $ul);
		sortList ($ul);
	    } else if(member.type == 'module') {
		var url = qualifiedModuleNameToUrl(member.qualifiedName);
		var $elem = $(treeModuleNode(name, url));
		$parentList.append($elem);

		if(member.qualifiedName == Title) { // Current module.
		    $elem.find('a').append(' <i class="icon-asterisk"></i>');

		    var $up = $parentList;
		    while(!$up.is($listHeader)) {
			$up.show();
			$up = $up.parent();
		    }
		}
	    } else if (member.type == 'module_package') {
		var url = qualifiedModuleNameToUrl(member.qualifiedName);
		var $elem = $(treeModulePackageNode(name, url));
		$parentList.append($elem);

		var $ul = $elem.find('ul');
		if($parentList != $listHeader) {
		    $ul.hide();
		}

		if(member.qualifiedName == Title) { // Current module.
		    $elem.find('a').append(' <i class="icon-asterisk"></i>');

		    var $up = $ul;
		    while(!$up.is($listHeader)) {
			$up.show();
			$up = $up.parent();
		    }
		}

		
		traverser(member, $ul);
		sortList ($ul);
	    }
	}
    }

    traverser(modTree, $listHeader);
}

/**
 * Build a relative path for the given module name.
 */
function moduleNameToPath(modName) {
    return modName.replace(/\::/g, '/') + '.yr';
}

/**
 * Configure the breadcrumb component at the top of the page
 * with the current module.
 */
function updateBreadcrumb(qualifiedName, sourceRepoUrl) {
    var $breadcrumb = $('#module-breadcrumb');

    var parts = qualifiedName.split('::');

    for(var i = 0; i < parts.length; i++) {
	var part = parts[i];
	
	if(i == parts.length - 1) {
	    var sourceUrl = sourceRepoUrl + '/' + moduleNameToPath(qualifiedName);
	    $breadcrumb.append('<li class="active"><h2>' + part + ' <a href="' + sourceUrl + '"><small>view source</small></a></h2></li>');
	} else {
	    $breadcrumb.append('<li><h2>' + part + '<span class="divider">/</span></h2></li>');
	}
    }
}

var enumRegex = /^enum /;
var structRegex = /^struct /;
var classRegex = /^class /;
var modRegex = /^mod /;
var traitRegex = /^trait /;
var templateRegex = /^template /;
var functionRegex = /^def /;
var propertyRegex = /@property/m;
var constructorRegex = /^[^(]*?self\(+/;

/**
 * Build a table out of all symbols declared in the current module.
 */
function buildSymbolTree() {
    function fillTree(parentNode, $parent) {
	$parent.children('.declaration').each(function() {
	    var $decl = $(this);
	    var text = $decl.text().trim ();
	    
	    var $symbolLink = $decl.find('.symbol-link');
	    var $symbolTarget = $decl.find('.symbol-target');
	    
	    var symbol;
	    if($symbolLink.length == 0) { // Special member (e.g. constructor).
		if(constructorRegex.test(text)) {
		    symbol = 'self';
		}
	    } else {
		symbol = $symbolLink.html();
	    }
	    
	    function fillSubTree(type) {
		var subTree = {
		    'name': symbol,
		    'type': type,
		    'members': new Array(),
		    'decl': $decl,
		    'symbolLinkNode': $symbolLink,
		    'symbolTargetNode': $symbolTarget
		};

		parentNode.push(subTree);
		
		var subMembers = $decl.next('.declaration-content').children('.member-list');
		subMembers.each (function () {		    
		    fillTree (subTree.members, $(this))
		});
		    		
	    }

	    function addLeaf(type) {
		var leaf = {
		    'name': symbol,
		    'type': type,
		    'decl': $decl,
		    'symbolLinkNode': $symbolLink,
		    'symbolTargetNode': $symbolTarget
		};

		parentNode.push(leaf);
	    }
	    
	    if(symbol == 'self' || text == 'self') {
		symbol = 'self';
		addLeaf('constructor');
	    } else if(enumRegex.test(text)) {
		fillSubTree('enum');
	    } else if(structRegex.test(text)) {
		fillSubTree('struct');
	    } else if(classRegex.test(text)) {
		fillSubTree('class');
	    } else if(templateRegex.test(text)) {
		fillSubTree('template');
	    } else if (modRegex.test (text)) {
		fillSubTree ('mod');
	    } else if (traitRegex.test (text)) {
		fillSubTree ('trait');
	    } else if(functionRegex.test(text)) {
		addLeaf('function');		
	    } else {
		addLeaf('variable');
	    }
	});
    }

    var $declRoot = $('#declaration-list');
    var tree = new Array();

    fillTree(tree, $declRoot);

    return tree;
}

/**
 * Create the symbol list in the sidebar.
 * Returns an array of the anchor names for the symbols in the list.
 */
function populateSymbolList(tree) {
    function jumpNode (name, anchor, type) {
	return '<div id=quickindex.' + name + '" class="quickindex"><p><b>Jump to: </b><span class="jumpto notranslate donthyphenate"></p></div>';
    }
    
    function expandableNode(name, anchor, type) {
	return '<li class="dropdown sidebar-list-entry"><span>' +
	    '<i class="ddoc-icon-' + type + '"></i><a class="symbol-link" href="#' + anchor + '" title="' + name + '">' + name + '</a>' +
	    '</span><ul class="custom-icon-list"></ul></li>';
    }

    function leafNode(name, anchor, type) {
	return '<li class="sidebar-list-entry"><span><i class="ddoc-icon-' + type + '"></i><a class="symbol-link" href="#' + anchor + '" title="' + name + '">' + name + '</a></span></li>';
    }

    function leafNodeJump (name, anchor, type) {
	return '<a href="#' + anchor + '">' + name + '</a>';
    }

    var anchorNames = new Array();

    function traverser(parent, $parent, $parentJump, anchorTail) {
	for(var i = 0; i < parent.length; i++) {
	    var node = parent[i];
	    var isTree = typeof node.members !== 'undefined';
	    var anchorName = anchorTail + node.name;
	    anchorNames.push(anchorName);

	    if(node.type == 'constructor') { // Constructor fixup.
		var $decl = node.decl;

		// Bare DDOC_PSYMBOL
		var symbolTemplate = '<span class="symbol-target">&nbsp;</span><a class="symbol-link">self</a>';

		var fixedSymbol = $decl.html().replace(/self/, symbolTemplate);
		$decl.html(fixedSymbol);

		node.symbolTargetNode = $decl.find('.symbol-target');
		node.symbolLinkNode = $decl.find('.symbol-link');
		
		node.type = 'function'; // Use the same list icon as functions.
	    }

	    node.symbolTargetNode.attr('id', anchorName);
	    node.symbolLinkNode.attr('href', '#' + anchorName);
	    
	    if(isTree) {
		var $node = $(expandableNode(node.name, anchorName, node.type));
		$parent.append($node);

		if(node.members.length > 0) {
		    var $caret = $('<b class="caret tree-node-standalone"></b>');
		    $node.find('span').append($caret);
		}

		var $list = $node.find('ul');
		$list.attr('id', anchorName + '_member-list');
		$list.hide(); // Default to closed.

		var $jump_node = $(jumpNode (node.name, anchorName, node.type));
		node.decl.prepend ($jump_node);
		var $inner_jump = $jump_node.find ('span');
		
		
		traverser(node.members, $list, $inner_jump, anchorName + '.');
	    } else {
		var $node = $(leafNode(node.name, anchorName, node.type));
		$parent.append($node);
		
		if ($parentJump != '') {
		    var $node_jump = $(leafNodeJump (node.name, anchorName, node.type));
		    if (i != 0) {
			$parentJump.append (" . ");
		    }
		    $parentJump.append ($node_jump)
		}
	    }
	}
    }

    var $symbolHeader = $('#symbol-list');
    $symbolHeader.removeClass('hidden');
    console.log (tree)
    
    traverser(tree, $symbolHeader.parent(), '', '');

    
    return anchorNames;
}

/**
 * Set the current symbol to highlight.
 */
function highlightSymbol(targetId) {
    function escapeId(id) {
	return id.replace(/\./g, '\\.');
    }

    var $target = $(escapeId(targetId)).parent();

    if(window.currentlyHighlightedSymbol) {
	window.currentlyHighlightedSymbol.removeClass('highlighted-symbol');
    }

    $target.addClass('highlighted-symbol');

    window.currentlyHighlightedSymbol = $target;

    // Open symbol list down to highlighted symbol.
    function eatHead(name) {
	var i = name.lastIndexOf('.');
	if(i != -1) {
	    return name.slice(0, i);
	}
    }

    var nodeName = eatHead(targetId);
    while(typeof nodeName !== 'undefined') {
	$(escapeId(nodeName) + '_member-list').show();
	nodeName = eatHead(nodeName);
    }
}

/**
 * Configure the goto-symbol search form in the titlebar.
 */
function setupGotoSymbolForm(typeaheadData) {
    var $form = $('#gotosymbol');
    var $input = $form.children('input');

    function go(target) {
	window.location.hash = target;
	highlightSymbol('#' + target);
	$input.blur();
    }

    $form.submit(function(event) {
	event.preventDefault();

	go($input.val());

	$input.val('');
    });

    $input.typeahead({
	'source': typeaheadData,
	'updater': function(item) {
	    go(item);
	    return '';
	}
    });

    $form.removeClass('hidden');
}

function sortList(ul) {
  Array.from(ul.children("li"))
    .sort((a, b) => a.textContent.localeCompare(b.textContent))
    .forEach(li => ul.append(li));
}



// 'Title' and 'SourceRepository' are created inline in the DDoc generated HTML page.
$(document).ready(function() {

    // Syntax highlighting Configuration
    hljs.configure({
        tabReplace: '    ', // 4 spaces
        languages: [],      // Languages used for auto-detection
    });

    if (window.ace) {
        // language-rust class needs to be removed for editable
        // blocks or highlightjs will capture events
        $('code.editable').removeClass('language-rust');

        $('code').not('.editable').each(function(i, block) {
            hljs.highlightBlock(block);
        });
    } else {
        $('code').each(function(i, block) {
            hljs.highlightBlock(block);
        });
    }

    // Adding the hljs class gives code blocks the color css
    // even if highlighting doesn't apply
    $('code').addClass('hljs');

    console.log (SourceRepository);
    // Setup page title.
    updateBreadcrumb(Title, SourceRepository);

    // Construct module list.
    populateModuleList(buildModuleTree(reapModuleList()));

    // Construct symbol list and setup goto-symbol form.
    var symbolTree = buildSymbolTree();
    if(symbolTree.length > 0) {
	var symbolAnchors = populateSymbolList(symbolTree);
	setupGotoSymbolForm(symbolAnchors);
    }

    // Setup symbol anchor highlighting.
    $('.symbol-link').click(function() {
	var targetId = $(this).attr('href');
	highlightSymbol(targetId);
    });

    if(document.location.hash.length > 0) {
	highlightSymbol(document.location.hash);
    }

    // Setup collapsable tree nodes.
    function treeNodeClick() {
	$(this).parent().children('ul').toggle();
    }

    function standaloneNodeClick() {
	$(this).parent().parent().children('ul').toggle();
    }
    
    var $treeNodes = $('.tree-node');
    var $standaloneTreeNodes = $('.tree-node-standalone');
    var $memberNodes = $('.member-list-entry');
    
    $treeNodes.click(treeNodeClick);
    $standaloneTreeNodes.click(standaloneNodeClick);
});
